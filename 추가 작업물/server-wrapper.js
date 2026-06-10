const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const externalPort = Number(process.env.PORT || 4174);
const externalHost = process.env.HOST || "0.0.0.0";
const internalPort = Number(process.env.INTERNAL_SERVER_PORT || 4175);
const internalHost = "127.0.0.1";
const root = __dirname;
const dataDir = path.join(root, "data");
const usersFile = path.join(dataDir, "users.json");
const sessionsFile = path.join(dataDir, "sessions.json");
const paymentsFile = path.join(dataDir, "payments.json");
const sessionCookie = "trendscope_session";

process.env.PORT = String(internalPort);
process.env.HOST = internalHost;
require("./server.js");

function frontendUrl() {
  return process.env.FRONTEND_URL || "https://juhyuk061210.github.io/-_-/";
}

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function allowedCorsOrigins() {
  const configured = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([originFromUrl(frontendUrl()), `http://127.0.0.1:${externalPort}`, ...configured].filter(Boolean));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !allowedCorsOrigins().has(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1 ? [item, ""] : [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function getCurrentUser(req) {
  const token = parseCookies(req)[sessionCookie];
  if (!token) return null;
  const sessions = await readJson(sessionsFile, []);
  const session = sessions.find((item) => item.token === token && new Date(item.expiresAt).getTime() > Date.now());
  if (!session) return null;
  const users = await readJson(usersFile, []);
  return users.find((user) => user.id === session.userId) || null;
}

function customerKey(user) {
  return `trendscope_${crypto.createHash("sha256").update(user.id).digest("hex").slice(0, 32)}`;
}

function tossClientKey() {
  return process.env.TOSS_CLIENT_KEY || process.env.TOSS_BILLING_CLIENT_KEY || "";
}

function tossSecretKey() {
  return process.env.TOSS_SECRET_KEY || process.env.TOSS_BILLING_SECRET_KEY || "";
}

async function tossRequest(pathname, body) {
  const secretKey = tossSecretKey();
  if (!secretKey) {
    const error = new Error("TOSS_SECRET_KEY is required");
    error.status = 500;
    throw error;
  }

  const response = await fetch(`https://api.tosspayments.com${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Toss Payments request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function paymentOrderId() {
  return `ts_pay_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

async function recordPaymentOrder(order) {
  const payments = await readJson(paymentsFile, []);
  payments.push({
    id: crypto.randomUUID(),
    provider: "tosspayments",
    paymentKey: "",
    orderId: order.orderId,
    userId: order.userId,
    amount: order.amount,
    status: "REQUESTED",
    reason: "membership_widget",
    raw: order,
    createdAt: new Date().toISOString(),
  });
  await writeJson(paymentsFile, payments.slice(-1000));
}

async function setUserMembership(userId, membershipStatus) {
  const users = await readJson(usersFile, []);
  await writeJson(
    usersFile,
    users.map((user) => (user.id === userId ? { ...user, membershipStatus, updatedAt: new Date().toISOString() } : user)),
  );
}

async function confirmPayment(user, body) {
  const payments = await readJson(paymentsFile, []);
  const order = payments.find((item) => item.orderId === body.orderId && item.userId === user.id && item.status === "REQUESTED");
  if (!order) {
    const error = new Error("payment order not found");
    error.status = 400;
    throw error;
  }
  const amount = Number(order.amount);
  if (Number(body.amount) !== amount) {
    const error = new Error("invalid payment amount");
    error.status = 400;
    throw error;
  }

  const payment = await tossRequest("/v1/payments/confirm", {
    paymentKey: String(body.paymentKey),
    orderId: String(body.orderId),
    amount,
  });

  await writeJson(
    paymentsFile,
    payments
      .map((item) =>
        item.orderId === body.orderId && item.status === "REQUESTED"
          ? { ...item, paymentKey: payment.paymentKey || body.paymentKey, status: payment.status || "DONE", raw: payment, updatedAt: new Date().toISOString() }
          : item,
      )
      .slice(-1000),
  );
  await setUserMembership(user.id, "paid");
  return payment;
}

async function handlePayments(req, res, url) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === "/api/payments/config" && req.method === "GET") {
    const user = await getCurrentUser(req);
    sendJson(res, 200, {
      enabled: Boolean(tossClientKey()),
      clientKey: tossClientKey(),
      amount: Number(process.env.MEMBERSHIP_AMOUNT || 29800),
      currency: process.env.MEMBERSHIP_CURRENCY || "KRW",
      orderName: process.env.MEMBERSHIP_ORDER_NAME || "TrendScope Membership",
      customerKey: user ? customerKey(user) : "",
      variantKey: process.env.TOSS_WIDGET_VARIANT_KEY || "DEFAULT",
      agreementVariantKey: process.env.TOSS_WIDGET_AGREEMENT_VARIANT_KEY || "AGREEMENT",
    });
    return;
  }

  if (url.pathname === "/api/payments/order" && req.method === "POST") {
    const user = await getCurrentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "login required" });
      return;
    }
    const body = JSON.parse((await readBody(req)) || "{}");
    const baseAmount = Number(process.env.MEMBERSHIP_AMOUNT || 29800);
    const discountAmount = body.coupon ? 5000 : 0;
    const amount = Math.max(0, baseAmount - discountAmount);
    const order = {
      orderId: paymentOrderId(),
      amount,
      discountAmount,
      currency: process.env.MEMBERSHIP_CURRENCY || "KRW",
      orderName: process.env.MEMBERSHIP_ORDER_NAME || "TrendScope Membership",
      customerKey: customerKey(user),
      userId: user.id,
      customerEmail: user.email || "",
      customerName: user.name || "",
    };
    await recordPaymentOrder(order);
    sendJson(res, 200, order);
    return;
  }

  if (url.pathname === "/api/payments/confirm" && req.method === "POST") {
    const user = await getCurrentUser(req);
    if (!user) {
      sendJson(res, 401, { error: "login required" });
      return;
    }
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const payment = await confirmPayment(user, body);
      sendJson(res, 200, { ok: true, payment });
    } catch (error) {
      sendJson(res, error.status || 502, { error: error.message, details: error.payload || null });
    }
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function proxyToInternal(req, res) {
  const proxy = http.request(
    {
      hostname: internalHost,
      port: internalPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `${internalHost}:${internalPort}` },
    },
    (proxied) => {
      res.writeHead(proxied.statusCode || 500, proxied.headers);
      proxied.pipe(res);
    },
  );
  proxy.on("error", (error) => sendJson(res, 502, { error: error.message }));
  req.pipe(proxy);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${externalHost}:${externalPort}`}`);
    if (url.pathname.startsWith("/api/payments/")) {
      await handlePayments(req, res, url);
      return;
    }
    proxyToInternal(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(externalPort, externalHost, () => {
  console.log(`TrendScope wrapper running at http://${externalHost}:${externalPort}`);
});
