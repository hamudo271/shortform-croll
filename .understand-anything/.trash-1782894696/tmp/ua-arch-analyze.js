#!/usr/bin/env node
'use strict';
const fs = require('fs');

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) { console.error('usage: analyze.js <in> <out>'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const fileNodes = data.fileNodes || [];
  const importEdges = data.importEdges || [];
  const allEdges = data.allEdges || [];

  const byId = {};
  for (const n of fileNodes) byId[n.id] = n;

  // ---- Common prefix of filePaths ----
  const paths = fileNodes.map(n => n.filePath || '').filter(Boolean);
  function commonPrefixDir(paths) {
    if (paths.length === 0) return '';
    const split = paths.map(p => p.split('/'));
    let prefix = [];
    for (let i = 0; ; i++) {
      const seg = split[0][i];
      if (seg === undefined) break;
      if (split.every(s => s[i] === seg) && split.every(s => s.length > i + 1)) {
        prefix.push(seg);
      } else break;
    }
    return prefix.length ? prefix.join('/') + '/' : '';
  }
  const prefix = commonPrefixDir(paths);

  // ---- A. Directory grouping ----
  const directoryGroups = {};
  const nodeGroup = {}; // id -> group
  for (const n of fileNodes) {
    let p = n.filePath || '';
    if (prefix && p.startsWith(prefix)) p = p.slice(prefix.length);
    const segs = p.split('/');
    let group;
    if (segs.length > 1) group = segs[0];
    else group = '(root)';
    if (!directoryGroups[group]) directoryGroups[group] = [];
    directoryGroups[group].push(n.id);
    nodeGroup[n.id] = group;
  }

  // ---- B. Node type grouping ----
  const nodeTypeGroups = {};
  for (const n of fileNodes) {
    (nodeTypeGroups[n.type] = nodeTypeGroups[n.type] || []).push(n.id);
  }

  // ---- C. Adjacency: fan-in/fan-out ----
  const fanOut = {}, fanIn = {};
  for (const n of fileNodes) { fanOut[n.id] = 0; fanIn[n.id] = 0; }
  for (const e of importEdges) {
    if (fanOut[e.source] !== undefined) fanOut[e.source]++;
    if (fanIn[e.target] !== undefined) fanIn[e.target]++;
  }

  // ---- D. Cross-category edges (allEdges by node-type pair) ----
  const crossMap = {};
  for (const e of allEdges) {
    const st = byId[e.source] && byId[e.source].type;
    const tt = byId[e.target] && byId[e.target].type;
    if (!st || !tt) continue;
    if (st === tt) continue; // cross-category only
    const key = st + '' + tt + '' + e.type;
    crossMap[key] = (crossMap[key] || 0) + 1;
  }
  const crossCategoryEdges = Object.entries(crossMap).map(([k, count]) => {
    const [fromType, toType, edgeType] = k.split('');
    return { fromType, toType, edgeType, count };
  }).sort((a, b) => b.count - a.count);

  // ---- E. Inter-group import frequency ----
  const interMap = {};
  for (const e of importEdges) {
    const g1 = nodeGroup[e.source], g2 = nodeGroup[e.target];
    if (g1 === undefined || g2 === undefined) continue;
    if (g1 === g2) continue;
    const key = g1 + '' + g2;
    interMap[key] = (interMap[key] || 0) + 1;
  }
  const interGroupImports = Object.entries(interMap).map(([k, count]) => {
    const [from, to] = k.split('');
    return { from, to, count };
  }).sort((a, b) => b.count - a.count);

  // ---- F. Intra-group density ----
  const intraGroupDensity = {};
  const groupTotalEdges = {}, groupInternalEdges = {};
  for (const g of Object.keys(directoryGroups)) { groupTotalEdges[g] = 0; groupInternalEdges[g] = 0; }
  for (const e of importEdges) {
    const g1 = nodeGroup[e.source], g2 = nodeGroup[e.target];
    if (g1 !== undefined) groupTotalEdges[g1]++;
    if (g2 !== undefined && g2 !== g1) groupTotalEdges[g2]++;
    if (g1 !== undefined && g1 === g2) { groupInternalEdges[g1]++; groupTotalEdges[g1]--; } // avoid double count; count internal once
  }
  for (const g of Object.keys(directoryGroups)) {
    const internal = groupInternalEdges[g];
    const total = groupTotalEdges[g] + internal;
    intraGroupDensity[g] = { internalEdges: internal, totalEdges: total, density: total ? +(internal / total).toFixed(3) : 0 };
  }

  // ---- G. Directory & file pattern matching ----
  const dirPatterns = [
    [['routes','api','controllers','endpoints','handlers','controller','routers','serializers','blueprints'],'api'],
    [['services','core','lib','domain','logic','signals','composables','mailers','jobs','channels','internal'],'service'],
    [['models','db','data','persistence','repository','entities','migrations','entity','sql','database'],'data'],
    [['components','views','pages','ui','layouts','screens'],'ui'],
    [['middleware','plugins','interceptors','guards'],'middleware'],
    [['utils','helpers','common','shared','tools','templatetags','pkg'],'utility'],
    [['config','constants','env','settings','management','commands'],'config'],
    [['__tests__','test','tests','spec','specs'],'test'],
    [['types','interfaces','schemas','contracts','dtos','dto','request','response'],'types'],
    [['hooks'],'hooks'],
    [['store','state','reducers','actions','slices'],'state'],
    [['assets','static','public'],'assets'],
    [['cmd','bin'],'entry'],
    [['docs','documentation','wiki'],'documentation'],
    [['deploy','deployment','infra','infrastructure','docker','k8s','kubernetes','helm','charts','terraform','tf'],'infrastructure'],
    [['.github','.gitlab','.circleci'],'ci-cd'],
  ];
  function matchDir(name) {
    const lc = name.toLowerCase();
    for (const [names, label] of dirPatterns) if (names.includes(lc)) return label;
    return null;
  }
  const patternMatches = {};
  for (const g of Object.keys(directoryGroups)) {
    const m = matchDir(g);
    if (m) patternMatches[g] = m;
  }

  // File-level pattern classification (per file)
  function classifyFile(fp, name, type) {
    const base = name || fp.split('/').pop();
    if (/\.(test|spec)\.[jt]sx?$/.test(base) || /^test_.*\.py$/.test(base) || /_test\.go$/.test(base) || /Test\.java$/.test(base) || /_spec\.rb$/.test(base) || /Test\.php$/.test(base) || /Tests\.cs$/.test(base)) return 'test';
    if (/\.d\.ts$/.test(base)) return 'types';
    if (/^(Dockerfile|docker-compose)/.test(base)) return 'infrastructure';
    if (/\.tf$|\.tfvars$/.test(base)) return 'infrastructure';
    if (/Jenkinsfile/.test(base) || /\.gitlab-ci\.yml$/.test(base)) return 'ci-cd';
    if (fp.includes('.github/workflows/')) return 'ci-cd';
    if (/\.sql$/.test(base)) return 'data';
    if (/\.(graphql|gql|proto)$/.test(base)) return 'types';
    if (/\.(md|rst)$/.test(base)) return 'documentation';
    if (/^Makefile$/.test(base)) return 'infrastructure';
    return null;
  }
  const fileClassifications = {};
  for (const n of fileNodes) {
    const c = classifyFile(n.filePath || '', n.name || '', n.type);
    if (c) fileClassifications[n.id] = c;
  }

  // ---- H. Deployment topology ----
  const infraFiles = [];
  let hasDockerfile = false, hasCompose = false, hasK8s = false, hasTerraform = false, hasCI = false;
  for (const n of fileNodes) {
    const fp = n.filePath || '', base = (n.name || '').toLowerCase();
    if (/^dockerfile/i.test(n.name || '')) { hasDockerfile = true; infraFiles.push(fp); }
    else if (/^docker-compose/i.test(n.name || '')) { hasCompose = true; infraFiles.push(fp); }
    else if (/\.ya?ml$/.test(base) && /(k8s|kubernetes|deployment|manifest)/i.test(fp)) { hasK8s = true; infraFiles.push(fp); }
    else if (/\.tf$/.test(base)) { hasTerraform = true; infraFiles.push(fp); }
    else if (fp.includes('.github/workflows/') || /jenkinsfile|\.gitlab-ci/i.test(base)) { hasCI = true; infraFiles.push(fp); }
    else if (/railway\.json|render\.yaml|vercel\.json|fly\.toml|Procfile/i.test(n.name || '')) { infraFiles.push(fp); }
  }
  const deploymentTopology = { hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI, infraFiles };

  // ---- I. Data pipeline ----
  const dataPipeline = { schemaFiles: [], migrationFiles: [], dataModelFiles: [], apiHandlerFiles: [] };
  for (const n of fileNodes) {
    const fp = n.filePath || '', tags = (n.tags || []).map(t => t.toLowerCase());
    if (/\.(sql|graphql|gql|proto|prisma)$/.test(fp) || n.type === 'schema' || n.type === 'table') dataPipeline.schemaFiles.push(fp);
    if (/migrations?\//.test(fp)) dataPipeline.migrationFiles.push(fp);
    if (/models?\//.test(fp) || tags.includes('model') || tags.includes('orm')) dataPipeline.dataModelFiles.push(fp);
    if (fp.includes('/api/') || tags.includes('api-handler') || tags.includes('route-handler')) dataPipeline.apiHandlerFiles.push(fp);
  }

  // ---- J. Documentation coverage ----
  const docGroups = new Set();
  for (const n of fileNodes) {
    if (n.type === 'document' || /\.(md|rst)$/.test(n.filePath || '')) docGroups.add(nodeGroup[n.id]);
  }
  const allGroups = Object.keys(directoryGroups);
  const undocumentedGroups = allGroups.filter(g => !docGroups.has(g));
  const docCoverage = {
    groupsWithDocs: docGroups.size,
    totalGroups: allGroups.length,
    coverageRatio: allGroups.length ? +(docGroups.size / allGroups.length).toFixed(2) : 0,
    undocumentedGroups
  };

  // ---- K. Dependency direction ----
  const pairNet = {};
  for (const { from, to, count } of interGroupImports) {
    const key = [from, to].sort().join('');
    if (!pairNet[key]) pairNet[key] = {};
    pairNet[key][from + '>' + to] = count;
  }
  const dependencyDirection = [];
  for (const { from, to, count } of interGroupImports) {
    const rev = interGroupImports.find(x => x.from === to && x.to === from);
    const revCount = rev ? rev.count : 0;
    if (count > revCount) dependencyDirection.push({ dependent: from, dependsOn: to, net: count - revCount });
  }
  // dedupe
  const seen = new Set();
  const dependencyDirectionDedup = dependencyDirection.filter(d => {
    const k = d.dependent + '>' + d.dependsOn;
    if (seen.has(k)) return false; seen.add(k); return true;
  }).sort((a, b) => b.net - a.net);

  // ---- File stats ----
  const filesPerGroup = {}; for (const g of allGroups) filesPerGroup[g] = directoryGroups[g].length;
  const nodeTypeCounts = {}; for (const t of Object.keys(nodeTypeGroups)) nodeTypeCounts[t] = nodeTypeGroups[t].length;

  const result = {
    scriptCompleted: true,
    commonPrefix: prefix,
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    fileClassifications,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection: dependencyDirectionDedup,
    fileStats: { totalFileNodes: fileNodes.length, filesPerGroup, nodeTypeCounts },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
  };
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.error('OK: ' + fileNodes.length + ' file nodes, ' + allGroups.length + ' groups');
}
try { main(); } catch (e) { console.error(e && e.stack || e); process.exit(1); }
