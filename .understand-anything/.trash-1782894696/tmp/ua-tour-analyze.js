#!/usr/bin/env node
'use strict';

const fs = require('fs');

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(raw);
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const layers = data.layers || [];

  const nodeById = new Map();
  for (const n of nodes) nodeById.set(n.id, n);

  // --- Node summary index ---
  const nodeSummaryIndex = {};
  for (const n of nodes) {
    nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary || '' };
  }

  // --- Fan-in / Fan-out ---
  const fanIn = new Map();
  const fanOut = new Map();
  for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
  for (const e of edges) {
    if (fanOut.has(e.source)) fanOut.set(e.source, fanOut.get(e.source) + 1);
    if (fanIn.has(e.target)) fanIn.set(e.target, fanIn.get(e.target) + 1);
  }

  const fanInRanking = [...fanIn.entries()]
    .map(([id, c]) => ({ id, fanIn: c, name: (nodeById.get(id) || {}).name || id }))
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 20);

  const fanOutRanking = [...fanOut.entries()]
    .map(([id, c]) => ({ id, fanOut: c, name: (nodeById.get(id) || {}).name || id }))
    .sort((a, b) => b.fanOut - a.fanOut)
    .slice(0, 20);

  // --- Percentile helpers for entry point scoring ---
  const fanOutVals = [...fanOut.values()].sort((a, b) => a - b);
  const fanInVals = [...fanIn.values()].sort((a, b) => a - b);
  function percentileThreshold(sortedVals, p) {
    if (sortedVals.length === 0) return 0;
    const idx = Math.floor((sortedVals.length - 1) * p);
    return sortedVals[idx];
  }
  const fanOutTop10 = percentileThreshold(fanOutVals, 0.9);
  const fanInBottom25 = percentileThreshold(fanInVals, 0.25);

  const ENTRY_NAMES = new Set([
    'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
    'server.ts', 'server.js', 'mod.rs', 'main.go', 'main.py', 'main.rs',
    'manage.py', 'app.py', 'wsgi.py', 'asgi.py', 'run.py', '__main__.py',
    'Application.java', 'Main.java', 'Program.cs', 'config.ru', 'index.php',
    'App.swift', 'Application.kt', 'main.cpp', 'main.c',
    // Next.js App Router shell files behave as entry points
    'layout.tsx', 'layout.jsx'
  ]);

  function depth(filePath) {
    if (!filePath) return 99;
    return filePath.split('/').filter(Boolean).length - 1;
  }

  const entryScores = [];
  for (const n of nodes) {
    let score = 0;
    const fp = n.filePath || '';
    const name = n.name || '';
    if (n.type === 'document') {
      if (name === 'README.md' && depth(fp) === 0) score += 5;
      else if (/\.md$/i.test(name) && depth(fp) === 0) score += 2;
    } else if (n.type === 'file') {
      if (ENTRY_NAMES.has(name)) score += 3;
      const d = depth(fp);
      if (d <= 1) score += 1;
      // Root-level app router layout gets a nudge
      if (fp === 'src/app/layout.tsx') score += 2;
      if ((fanOut.get(n.id) || 0) >= fanOutTop10 && fanOutTop10 > 0) score += 1;
      if ((fanIn.get(n.id) || 0) <= fanInBottom25) score += 1;
    }
    if (score > 0) {
      entryScores.push({ id: n.id, score, name, summary: n.summary || '' });
    }
  }
  entryScores.sort((a, b) => b.score - a.score);
  const entryPointCandidates = entryScores.slice(0, 5);

  // --- BFS from top CODE entry point ---
  const forwardAdj = new Map();
  for (const n of nodes) forwardAdj.set(n.id, []);
  const traversalEdgeTypes = new Set(['imports', 'calls', 'contains', 'depends_on']);
  for (const e of edges) {
    if (traversalEdgeTypes.has(e.type) && forwardAdj.has(e.source)) {
      forwardAdj.get(e.source).push(e.target);
    }
  }

  // Pick top code entry point (skip document nodes)
  let startNode = null;
  for (const c of entryScores) {
    const n = nodeById.get(c.id);
    if (n && n.type !== 'document') { startNode = c.id; break; }
  }
  if (!startNode && nodes.length) {
    // fallback: highest fan-out non-document
    const fallback = fanOutRanking.find(r => {
      const n = nodeById.get(r.id);
      return n && n.type !== 'document';
    });
    startNode = fallback ? fallback.id : nodes[0].id;
  }

  const order = [];
  const depthMap = {};
  if (startNode) {
    const queue = [startNode];
    depthMap[startNode] = 0;
    const visited = new Set([startNode]);
    while (queue.length) {
      const cur = queue.shift();
      order.push(cur);
      for (const nxt of (forwardAdj.get(cur) || [])) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          depthMap[nxt] = depthMap[cur] + 1;
          queue.push(nxt);
        }
      }
    }
  }
  const byDepth = {};
  for (const [id, d] of Object.entries(depthMap)) {
    (byDepth[d] = byDepth[d] || []).push(id);
  }

  // --- Non-code file inventory ---
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const n of nodes) {
    const entry = { id: n.id, name: n.name, type: n.type, summary: n.summary || '' };
    switch (n.type) {
      case 'document':
        nonCodeFiles.documentation.push(entry); break;
      case 'service':
      case 'pipeline':
      case 'resource':
        nonCodeFiles.infrastructure.push(entry); break;
      case 'table':
      case 'schema':
      case 'endpoint':
        nonCodeFiles.data.push(entry); break;
      case 'config':
        nonCodeFiles.config.push(entry); break;
      default:
        break;
    }
  }

  // --- Tightly coupled clusters ---
  // Build directional edge sets for imports/calls
  const pairKey = (a, b) => a + '||' + b;
  const relEdges = edges.filter(e => e.type === 'imports' || e.type === 'calls');
  const edgeSet = new Set(relEdges.map(e => pairKey(e.source, e.target)));

  // Adjacency for expansion (undirected count of imports/calls)
  const undirectedCount = new Map();
  function addUndirected(a, b) {
    const k = a < b ? pairKey(a, b) : pairKey(b, a);
    undirectedCount.set(k, (undirectedCount.get(k) || 0) + 1);
  }
  for (const e of relEdges) addUndirected(e.source, e.target);

  // Seed clusters from bidirectional pairs
  const clustersRaw = [];
  const seenSeed = new Set();
  for (const e of relEdges) {
    const a = e.source, b = e.target;
    if (edgeSet.has(pairKey(b, a))) {
      const key = a < b ? pairKey(a, b) : pairKey(b, a);
      if (!seenSeed.has(key)) {
        seenSeed.add(key);
        clustersRaw.push(new Set([a, b]));
      }
    }
  }

  // Neighbor lookup (undirected)
  const neighbors = new Map();
  for (const n of nodes) neighbors.set(n.id, new Set());
  for (const e of relEdges) {
    if (neighbors.has(e.source)) neighbors.get(e.source).add(e.target);
    if (neighbors.has(e.target)) neighbors.get(e.target).add(e.source);
  }

  // Expand each cluster: add nodes connected to 2+ current members, cap at 5
  for (const cluster of clustersRaw) {
    let changed = true;
    while (changed && cluster.size < 5) {
      changed = false;
      const candidateCounts = new Map();
      for (const m of cluster) {
        for (const nb of (neighbors.get(m) || [])) {
          if (!cluster.has(nb)) {
            candidateCounts.set(nb, (candidateCounts.get(nb) || 0) + 1);
          }
        }
      }
      let best = null, bestCount = 0;
      for (const [cand, cnt] of candidateCounts) {
        if (cnt >= 2 && cnt > bestCount) { best = cand; bestCount = cnt; }
      }
      if (best) { cluster.add(best); changed = true; }
    }
  }

  // Count internal edges per cluster and dedupe
  function edgeCountFor(nodeList) {
    let cnt = 0;
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = 0; j < nodeList.length; j++) {
        if (i !== j && edgeSet.has(pairKey(nodeList[i], nodeList[j]))) cnt++;
      }
    }
    return cnt;
  }
  const clusterFinal = [];
  const clusterKeys = new Set();
  for (const c of clustersRaw) {
    const list = [...c].sort();
    if (list.length < 2) continue;
    const k = list.join('||');
    if (clusterKeys.has(k)) continue;
    clusterKeys.add(k);
    clusterFinal.push({ nodes: list, edgeCount: edgeCountFor(list) });
  }
  clusterFinal.sort((a, b) => b.edgeCount - a.edgeCount || b.nodes.length - a.nodes.length);
  const clusters = clusterFinal.slice(0, 10);

  // --- Layers ---
  const layerOut = {
    count: layers.length,
    list: layers.map(l => ({ id: l.id, name: l.name, description: l.description }))
  };

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: { startNode, order, depthMap, byDepth },
    nonCodeFiles,
    clusters,
    layers: layerOut,
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log('Analysis complete:', outputPath);
  console.log('  entry candidates:', entryPointCandidates.length,
    '| bfs reached:', order.length,
    '| clusters:', clusters.length);
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('FATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
}
