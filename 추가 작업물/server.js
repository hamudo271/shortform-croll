const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const dataDir = path.join(root, "data");
const communityFile = path.join(dataDir, "community.json");
const usersFile = path.join(dataDir, "users.json");
const oauthAccountsFile = path.join(dataDir, "oauth_accounts.json");
const sessionsFile = path.join(dataDir, "sessions.json");
const profilesFile = path.join(dataDir, "profiles.json");
const billingFile = path.join(dataDir, "billings.json");
const paymentsFile = path.join(dataDir, "payments.json");
let port = Number(process.env.PORT || 4174);
let host = process.env.HOST || "127.0.0.1";
const sessionCookie = "trendscope_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const testCheckoutAmount = Number(process.env.TOSS_TEST_CHECKOUT_AMOUNT || 15000);
const maxStoredPosts = Number(process.env.MAX_STORED_POSTS || 500);
const defaultCommunityLimit = Number(process.env.COMMUNITY_FEED_LIMIT || 80);
const maxCommunityLimit = Number(process.env.COMMUNITY_FEED_MAX_LIMIT || 150);
const jsonWriteQueues = new Map();
const writeRateLimit = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

async function loadDotEnv() {
  try {
    const raw = await fs.readFile(path.join(root, ".env"), "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // .env is optional. Real secrets must stay local and out of source files.
  }
}

function baseUrl() {
  return process.env.BASE_URL || `http://127.0.0.1:${port}`;
}

function providerRedirectUri(provider) {
  const envKey = `${provider.toUpperCase()}_REDIRECT_URI`;
  return process.env[envKey] || `${baseUrl()}/api/auth/${provider}/callback`;
}

async function ensureJsonFile(filePath, fallback) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

async function readJson(filePath, fallback) {
  await ensureJsonFile(filePath, fallback);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw || JSON.stringify(fallback));
}

async function writeJson(filePath, value) {
  await ensureJsonFile(filePath, Array.isArray(value) ? [] : {});
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

async function withJsonLock(filePath, task) {
  const previous = jsonWriteQueues.get(filePath) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (jsonWriteQueues.get(filePath) === current) jsonWriteQueues.delete(filePath);
    });
  jsonWriteQueues.set(filePath, current);
  return current;
}

async function updateJson(filePath, fallback, updater) {
  return withJsonLock(filePath, async () => {
    const value = await readJson(filePath, fallback);
    const nextValue = await updater(value);
    const valueToWrite = nextValue === undefined ? value : nextValue;
    await writeJson(filePath, valueToWrite);
    return valueToWrite;
  });
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function cookieValue(value) {
  return encodeURIComponent(value);
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${cookieValue(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  parts.push(`Path=${options.path || "/"}`);
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const index = item.indexOf("=");
      if (index === -1) return cookies;
      cookies[item.slice(0, index)] = decodeURIComponent(item.slice(index + 1));
      return cookies;
    }, {});
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0].trim();
}

function allowWrite(req, bucket = "default") {
  const now = Date.now();
  const key = `${clientIp(req)}:${bucket}`;
  const windowMs = 10_000;
  const maxWrites = 35;
  const record = writeRateLimit.get(key) || { count: 0, resetAt: now + windowMs };
  if (record.resetAt <= now) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  record.count += 1;
  writeRateLimit.set(key, record);
  return record.count <= maxWrites;
}

function requireWriteCapacity(req, res, bucket = "default") {
  if (allowWrite(req, bucket)) return true;
  sendJson(res, 429, { error: "too many requests" });
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_242_880) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function cleanText(value, max) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

function cleanImage(value) {
  const image = String(value || "");
  if (!image) return "";
  if (!image.startsWith("data:image/")) return "";
  if (image.length > 2_000_000) return "";
  return image;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function onlyDigits(value, max = 64) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}

function cleanPaymentText(value, max) {
  return String(value || "").replace(/[<>"]/g, "").trim().slice(0, max);
}

function nicepayConfig() {
  const clientKey = process.env.NICEPAY_CLIENT_KEY || "";
  const secretKey = process.env.NICEPAY_SECRET_KEY || "";
  if (!clientKey || !secretKey) {
    throw new Error("NICEPAY_CLIENT_KEY and NICEPAY_SECRET_KEY are required");
  }

  return {
    mode: process.env.NICEPAY_MODE || "test",
    clientKey,
    secretKey,
    amount: Number(process.env.NICEPAY_MEMBERSHIP_AMOUNT || 29800),
    goodsName: process.env.NICEPAY_GOODS_NAME || "TrendScope Membership",
  };
}

function nicepayApiBase(config) {
  return config.mode === "live" ? "https://api.nicepay.co.kr" : "https://sandbox-api.nicepay.co.kr";
}

function nicepayAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.clientKey}:${config.secretKey}`).toString("base64")}`;
}

function nicepayOrderId(prefix) {
  const time = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const rand = crypto.randomBytes(5).toString("hex");
  return `${prefix}_${time}_${rand}`.slice(0, 64);
}

function nicepayEdiDate() {
  return new Date().toISOString();
}

function encryptNicepayBillingCard(card, secretKey) {
  const plain = [
    `cardNo=${onlyDigits(card.cardNo, 16)}`,
    `expYear=${onlyDigits(card.expYear, 2)}`,
    `expMonth=${onlyDigits(card.expMonth, 2)}`,
    `idNo=${onlyDigits(card.idNo, 13)}`,
    `cardPw=${onlyDigits(card.cardPw, 2)}`,
  ].join("&");
  const key = Buffer.from(secretKey.slice(0, 16), "utf8");
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("hex");
}

async function callNicepay(pathname, payload) {
  const config = nicepayConfig();
  const response = await fetch(`${nicepayApiBase(config)}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Authorization: nicepayAuthHeader(config),
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

function nicepayResultCode(data) {
  return data.resultCode || data.ResultCode || "";
}

function nicepayBid(data) {
  return data.bid || data.BID || "";
}

function publicBillingRecord(record) {
  return {
    id: record.id,
    orderId: record.orderId,
    bid: record.bid,
    buyerName: record.buyerName,
    buyerEmail: record.buyerEmail,
    buyerTel: record.buyerTel,
    cardName: record.cardName,
    cardCode: record.cardCode,
    status: record.status,
    createdAt: record.createdAt,
  };
}

async function readProfiles() {
  return readJson(profilesFile, {});
}

async function profileForUser(user) {
  if (!user) return null;
  const profiles = await readProfiles();
  return {
    id: user.id,
    email: user.email,
    name: profiles[user.id]?.name || user.name || "Member",
    profileImage: profiles[user.id]?.profileImage || user.profileImage || "",
    bio: profiles[user.id]?.bio || "",
    role: user.role,
    membershipStatus: user.membershipStatus,
  };
}

async function decorateUser(user) {
  const profile = await profileForUser(user);
  return profile ? { ...user, ...profile } : user;
}

async function syncAuthorProfile(userId, profile) {
  await updateJson(communityFile, [], (storedPosts) => {
    const posts = storedPosts.map(normalizePost);
    let changed = false;

    posts.forEach((post) => {
      if (post.authorId === userId) {
        post.name = profile.name || post.name;
        post.profileImage = profile.profileImage || "";
        changed = true;
      }

      post.comments.forEach((comment) => {
        if (comment.authorId === userId) {
          comment.name = profile.name || comment.name;
          comment.profileImage = profile.profileImage || "";
          changed = true;
        }
      });
    });

    return changed ? posts : storedPosts;
  });
}

function normalizePost(post) {
  const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
  const authorId = post.authorId || seedAuthorId(post.name);
  return {
    ...post,
    authorId,
    likedBy,
    likes: Math.max(Number(post.likes || 0), likedBy.length),
    comments: Array.isArray(post.comments)
      ? post.comments.map((comment) => ({
          ...comment,
          authorId: comment.authorId || seedAuthorId(comment.name),
          image: cleanImage(comment.image),
          status: comment.status || "published",
          updatedAt: comment.updatedAt || comment.createdAt,
        }))
      : [],
    image: cleanImage(post.image),
    status: post.status || "published",
    updatedAt: post.updatedAt || post.createdAt,
  };
}

function seedAuthorId(name) {
  if (name === "K") return "seed-k";
  if (name === "H") return "seed-h";
  return "";
}

function visiblePosts(posts) {
  return posts.map(normalizePost).filter((post) => post.status !== "deleted" && post.status !== "hidden");
}

function hotScore(post) {
  const ageHours = Math.max(1, (Date.now() - new Date(post.createdAt).getTime()) / 36e5);
  return post.likes * 3 + post.comments.length * 5 + 24 / ageHours;
}

function levelFromXp(xp) {
  const tiers = [
    { name: "Starter", min: 0 },
    { name: "Builder", min: 40 },
    { name: "Operator", min: 100 },
    { name: "Insider", min: 180 },
  ];
  const tier = [...tiers].reverse().find((item) => xp >= item.min) || tiers[0];
  const index = tiers.findIndex((item) => item.name === tier.name);
  const nextTier = tiers[index + 1] || null;
  const progress = nextTier ? Math.min(100, Math.round(((xp - tier.min) / (nextTier.min - tier.min)) * 100)) : 100;
  return {
    tier: tier.name,
    xp,
    progress,
    nextTier: nextTier?.name || "",
    nextXp: nextTier?.min || tier.min,
  };
}

function communityActivityForUser(posts, userId) {
  const items = visiblePosts(posts);
  const authoredPosts = items.filter((post) => post.authorId === userId);
  const authoredComments = items.flatMap((post) => post.comments).filter((comment) => comment.authorId === userId);
  const receivedLikes = authoredPosts.reduce((total, post) => total + Number(post.likes || 0), 0);
  const receivedComments = authoredPosts.reduce(
    (total, post) => total + post.comments.filter((comment) => comment.authorId !== userId && comment.status !== "hidden" && comment.status !== "deleted").length,
    0,
  );
  const xp = authoredPosts.length * 15 + authoredComments.length * 8 + receivedLikes * 5 + receivedComments * 3;
  return {
    ...levelFromXp(xp),
    stats: {
      posts: authoredPosts.length,
      comments: authoredComments.length,
      receivedLikes,
      receivedComments,
    },
  };
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function tossSecretKey() {
  return process.env.TOSS_SECRET_KEY || process.env.TOSS_BILLING_SECRET_KEY || "";
}

function tossAuthorizationHeader() {
  const secretKey = tossSecretKey();
  if (!secretKey) throw new Error("TOSS_SECRET_KEY is required");
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function tossRequest(pathname, body) {
  const response = await fetch(`https://api.tosspayments.com${pathname}`, {
    method: "POST",
    headers: {
      Authorization: tossAuthorizationHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Toss Payments request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function recordTestPayment(payment, meta = {}) {
  await updateJson(paymentsFile, [], (payments) => {
    payments.push({
      id: crypto.randomUUID(),
      provider: "tosspayments",
      paymentKey: payment.paymentKey || "",
      orderId: payment.orderId || meta.orderId || "",
      amount: Number(payment.totalAmount || payment.amount || meta.amount || 0),
      status: payment.status || "UNKNOWN",
      reason: "test_checkout",
      raw: payment,
      createdAt: new Date().toISOString(),
    });
    return payments.slice(-1000);
  });
}

async function confirmTestCheckoutPayment({ paymentKey, orderId, amount }) {
  const normalizedAmount = Number(amount);
  if (!paymentKey || !orderId || !normalizedAmount) {
    const error = new Error("missing payment data");
    error.status = 400;
    throw error;
  }

  if (normalizedAmount !== testCheckoutAmount) {
    const error = new Error("invalid test checkout amount");
    error.status = 400;
    throw error;
  }

  const payment = await tossRequest("/v1/payments/confirm", {
    paymentKey: String(paymentKey),
    orderId: String(orderId),
    amount: normalizedAmount,
  });
  await recordTestPayment(payment, { orderId: String(orderId), amount: normalizedAmount });
  return payment;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profileImage: user.profileImage,
    bio: user.bio || "",
    role: user.role,
    membershipStatus: user.membershipStatus,
  };
}

function adminBypassEnabled() {
  return process.env.ADMIN_BYPASS !== "false";
}

function demoAdminUser() {
  return {
    id: "local-admin",
    email: process.env.ADMIN_DEMO_EMAIL || "admin@trendscope.local",
    name: process.env.ADMIN_DEMO_NAME || "TrendScope Admin",
    profileImage: "",
    role: "admin",
    membershipStatus: "paid",
  };
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

async function getEffectiveUser(req) {
  return decorateUser((await getCurrentUser(req)) || (adminBypassEnabled() ? demoAdminUser() : null));
}

async function createSession(userId) {
  const now = Date.now();
  const session = {
    token: randomToken(),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + sessionMaxAgeSeconds * 1000).toISOString(),
  };
  await updateJson(sessionsFile, [], (sessions) => {
    const activeSessions = sessions.filter((item) => new Date(item.expiresAt).getTime() > now);
    activeSessions.push(session);
    return activeSessions;
  });
  return session;
}

async function destroySession(req) {
  const token = parseCookies(req)[sessionCookie];
  if (!token) return;
  await updateJson(sessionsFile, [], (sessions) => sessions.filter((item) => item.token !== token));
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function upsertOAuthUser(profile) {
  const users = await readJson(usersFile, []);
  const accounts = await readJson(oauthAccountsFile, []);
  const now = new Date().toISOString();
  const email = String(profile.email || "").toLowerCase();

  if (!email) throw new Error("OAuth profile did not include an email");

  let account = accounts.find((item) => item.provider === profile.provider && item.providerId === profile.providerId);
  let user = account ? users.find((item) => item.id === account.userId) : null;

  if (!user) {
    user = users.find((item) => String(item.email).toLowerCase() === email);
  }

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name: profile.name || email.split("@")[0],
      profileImage: profile.profileImage || "",
      role: adminEmails().includes(email) ? "admin" : "user",
      membershipStatus: "free",
      createdAt: now,
      updatedAt: now,
    };
    users.push(user);
  } else {
    user.email = user.email || email;
    user.name = profile.name || user.name;
    user.profileImage = profile.profileImage || user.profileImage || "";
    user.updatedAt = now;
  }

  if (!account) {
    account = {
      id: crypto.randomUUID(),
      userId: user.id,
      provider: profile.provider,
      providerId: profile.providerId,
      email,
      name: profile.name || "",
      profileImage: profile.profileImage || "",
      createdAt: now,
      updatedAt: now,
    };
    accounts.push(account);
  } else {
    account.email = email;
    account.name = profile.name || account.name;
    account.profileImage = profile.profileImage || account.profileImage;
    account.updatedAt = now;
  }

  await writeJson(usersFile, users);
  await writeJson(oauthAccountsFile, accounts);
  return user;
}

function requireEnv(provider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET are required`);
  }
  return { clientId, clientSecret };
}

function startOAuth(provider, res) {
  const { clientId } = requireEnv(provider);
  const state = randomToken(16);
  const stateCookie = serializeCookie(`oauth_state_${provider}`, state, { maxAge: 600 });
  const redirectUri = providerRedirectUri(provider);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });

  if (provider === "google") {
    params.set("scope", "openid email profile");
    redirect(res, `https://accounts.google.com/o/oauth2/v2/auth?${params}`, { "Set-Cookie": stateCookie });
    return;
  }

  if (provider === "naver") {
    redirect(res, `https://nid.naver.com/oauth2.0/authorize?${params}`, { "Set-Cookie": stateCookie });
    return;
  }

  throw new Error("Unsupported OAuth provider");
}

async function exchangeGoogleToken(code) {
  const { clientId, clientSecret } = requireEnv("google");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: providerRedirectUri("google"),
      grant_type: "authorization_code",
    }),
  });

  const token = await tokenResponse.json();
  if (!tokenResponse.ok) throw new Error(token.error_description || token.error || "Google token exchange failed");

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok) throw new Error("Google profile request failed");

  return {
    provider: "google",
    providerId: profile.sub,
    email: profile.email,
    name: profile.name,
    profileImage: profile.picture,
  };
}

async function exchangeNaverToken(code, state) {
  const { clientId, clientSecret } = requireEnv("naver");
  const tokenUrl = new URL("https://nid.naver.com/oauth2.0/token");
  tokenUrl.search = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
  });

  const tokenResponse = await fetch(tokenUrl);
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || token.error) throw new Error(token.error_description || token.error || "Naver token exchange failed");

  const profileResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profileResponse.ok || profile.resultcode !== "00") throw new Error(profile.message || "Naver profile request failed");

  return {
    provider: "naver",
    providerId: profile.response.id,
    email: profile.response.email,
    name: profile.response.name || profile.response.nickname,
    profileImage: profile.response.profile_image,
  };
}

async function handleOAuthCallback(provider, req, res, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(req);

  if (!code || !state || cookies[`oauth_state_${provider}`] !== state) {
    sendJson(res, 400, { error: "invalid oauth state" });
    return;
  }

  const profile = provider === "google" ? await exchangeGoogleToken(code) : await exchangeNaverToken(code, state);
  const user = await upsertOAuthUser(profile);
  const session = await createSession(user.id);
  const clearState = serializeCookie(`oauth_state_${provider}`, "", { maxAge: 0 });
  const sessionHeader = serializeCookie(sessionCookie, session.token, { maxAge: sessionMaxAgeSeconds });

  redirect(res, "/#community", { "Set-Cookie": [sessionHeader, clearState] });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/nicepay/config" && req.method === "GET") {
    try {
      const config = nicepayConfig();
      sendJson(res, 200, {
        mode: config.mode,
        amount: config.amount,
        goodsName: config.goodsName,
        hasClientKey: Boolean(config.clientKey),
        hasSecretKey: Boolean(config.secretKey),
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/nicepay/billing/register" && req.method === "POST") {
    if (!requireWriteCapacity(req, res, "nicepay-billing-register")) return;
    try {
      const config = nicepayConfig();
      const body = JSON.parse((await readBody(req)) || "{}");
      const card = {
        cardNo: onlyDigits(body.cardNo, 16),
        expYear: onlyDigits(body.expYear, 2),
        expMonth: onlyDigits(body.expMonth, 2),
        idNo: onlyDigits(body.idNo, 13),
        cardPw: onlyDigits(body.cardPw, 2),
      };

      if (card.cardNo.length < 14 || card.expYear.length !== 2 || card.expMonth.length !== 2 || card.idNo.length < 6 || card.cardPw.length !== 2) {
        sendJson(res, 400, { error: "cardNo, expYear, expMonth, idNo, cardPw are required" });
        return;
      }

      const orderId = nicepayOrderId("billkey");
      const ediDate = nicepayEdiDate();
      const payload = {
        encData: encryptNicepayBillingCard(card, config.secretKey),
        orderId,
        buyerName: cleanPaymentText(body.buyerName, 30),
        buyerEmail: cleanPaymentText(body.buyerEmail, 60),
        buyerTel: onlyDigits(body.buyerTel, 20),
        ediDate,
        signData: sha256Hex(orderId + ediDate + config.secretKey),
        returnCharSet: "utf-8",
      };

      const nicepay = await callNicepay("/v1/subscribe/regist", payload);
      const data = nicepay.data;
      const bid = nicepayBid(data);
      const resultCode = nicepayResultCode(data);
      const record = {
        id: crypto.randomUUID(),
        orderId,
        bid,
        buyerName: payload.buyerName,
        buyerEmail: payload.buyerEmail,
        buyerTel: payload.buyerTel,
        cardName: data.cardName || data.CardName || "",
        cardCode: data.cardCode || data.CardCode || "",
        resultCode,
        resultMsg: data.resultMsg || data.ResultMsg || "",
        tid: data.tid || data.TID || "",
        status: resultCode === "0000" && bid ? "active" : "failed",
        createdAt: new Date().toISOString(),
        nicepayStatus: nicepay.status,
      };

      await updateJson(billingFile, [], (records) => {
        records.push(record);
        return records.slice(-200);
      });

      sendJson(res, nicepay.status >= 400 ? 502 : 200, {
        ok: record.status === "active",
        billing: publicBillingRecord(record),
        nicepay: data,
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/nicepay/billing/pay" && req.method === "POST") {
    if (!requireWriteCapacity(req, res, "nicepay-billing-pay")) return;
    try {
      const config = nicepayConfig();
      const body = JSON.parse((await readBody(req)) || "{}");
      let bid = cleanPaymentText(body.bid, 80);
      const amount = Number(body.amount || config.amount);
      const goodsName = cleanPaymentText(body.goodsName || config.goodsName, 40);
      const buyerName = cleanPaymentText(body.buyerName, 30);
      const buyerEmail = cleanPaymentText(body.buyerEmail, 60);
      const buyerTel = onlyDigits(body.buyerTel, 20);

      if (!bid) {
        const records = await readJson(billingFile, []);
        const latest = [...records].reverse().find((record) => record.status === "active" && record.bid);
        bid = latest?.bid || "";
      }

      if (!bid || !amount || amount < 100 || !goodsName) {
        sendJson(res, 400, { error: "bid, amount and goodsName are required" });
        return;
      }

      const orderId = nicepayOrderId("subscribe");
      const ediDate = nicepayEdiDate();
      const payload = {
        orderId,
        amount,
        goodsName,
        cardQuota: "0",
        useShopInterest: false,
        buyerName,
        buyerEmail,
        buyerTel,
        ediDate,
        signData: sha256Hex(orderId + bid + ediDate + config.secretKey),
        returnCharSet: "utf-8",
      };

      const nicepay = await callNicepay(`/v1/subscribe/${encodeURIComponent(bid)}/payments`, payload);
      sendJson(res, nicepay.status >= 400 ? 502 : 200, {
        ok: nicepayResultCode(nicepay.data) === "0000",
        orderId,
        bid,
        nicepay: nicepay.data,
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const user = await getEffectiveUser(req);
    sendJson(res, 200, { authenticated: Boolean(user), user: publicUser(user) });
    return;
  }

  if (url.pathname === "/api/auth/demo-admin" && req.method === "POST") {
    const user = demoAdminUser();
    const session = await createSession(user.id);
    sendJson(
      res,
      200,
      { authenticated: true, user: publicUser(user) },
      { "Set-Cookie": serializeCookie(sessionCookie, session.token, { maxAge: sessionMaxAgeSeconds }) },
    );
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    await destroySession(req);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": serializeCookie(sessionCookie, "", { maxAge: 0 }) });
    return;
  }

  if (url.pathname === "/api/profile/me" && req.method === "PATCH") {
    if (!requireWriteCapacity(req, res, "profile")) return;
    const user = await getEffectiveUser(req);
    if (!user) {
      sendJson(res, 401, { error: "login required" });
      return;
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    let savedProfile = null;
    await updateJson(profilesFile, {}, (profiles) => {
      savedProfile = {
        ...profiles[user.id],
        name: cleanText(body.name, 28) || user.name,
        bio: cleanText(body.bio, 180),
        profileImage: cleanImage(body.profileImage),
        updatedAt: new Date().toISOString(),
      };
      return {
        ...profiles,
        [user.id]: savedProfile,
      };
    });

    await syncAuthorProfile(user.id, savedProfile);

    sendJson(res, 200, { user: publicUser(await decorateUser({ ...user, ...savedProfile })) });
    return;
  }

  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (profileMatch && req.method === "GET") {
    const profileId = decodeURIComponent(profileMatch[1]);
    const posts = visiblePosts(await readJson(communityFile, []));
    const profiles = await readProfiles();
    const users = await readJson(usersFile, []);
    let user = users.find((item) => item.id === profileId);

    if (!user && adminBypassEnabled() && profileId === "local-admin") user = demoAdminUser();

    const authoredPosts = posts.filter((post) => post.authorId === profileId);
    const authoredComments = posts
      .flatMap((post) =>
        post.comments.map((comment) => ({
          ...comment,
          postId: post.id,
          postTitle: post.title,
        })),
      )
      .filter((comment) => comment.authorId === profileId && comment.status !== "hidden" && comment.status !== "deleted");
    const profile = profiles[profileId];
    const authoredPost = authoredPosts[0];
    const authoredComment = authoredComments[0];

    if (!user && profile) {
      user = {
        id: profileId,
        email: "",
        name: profile.name || "Member",
        profileImage: profile.profileImage || "",
        role: "user",
        membershipStatus: "free",
      };
    }

    if (!user && (authoredPost || authoredComment)) {
      user = {
        id: profileId,
        email: "",
        name: authoredPost?.name || authoredComment?.name || "Member",
        profileImage: authoredPost?.profileImage || authoredComment?.profileImage || "",
        role: "user",
        membershipStatus: "free",
      };
    }

    if (!user) {
      sendJson(res, 404, { error: "profile not found" });
      return;
    }

    sendJson(res, 200, {
      user: publicUser(await decorateUser(user)),
      posts: authoredPosts.map((post) => ({
        id: post.id,
        title: post.title,
        message: post.message,
        image: post.image || "",
        likes: post.likes,
        commentCount: post.comments.filter((comment) => comment.status !== "hidden" && comment.status !== "deleted").length,
        createdAt: post.createdAt,
      })),
      comments: authoredComments.map((comment) => ({
        id: comment.id,
        postId: comment.postId,
        postTitle: comment.postTitle,
        message: comment.message,
        image: comment.image || "",
        createdAt: comment.createdAt,
      })),
    });
    return;
  }

  const oauthStart = url.pathname.match(/^(?:\/api)?\/auth\/(google|naver)\/start$/);
  if (oauthStart && req.method === "GET") {
    startOAuth(oauthStart[1], res);
    return;
  }

  const oauthCallback = url.pathname.match(/^(?:\/api)?\/auth\/(google|naver)\/callback$/);
  if (oauthCallback && req.method === "GET") {
    await handleOAuthCallback(oauthCallback[1], req, res, url);
    return;
  }

  if (url.pathname === "/api/community/level" && req.method === "GET") {
    const user = await getEffectiveUser(req);
    if (!user) {
      sendJson(res, 200, communityActivityForUser(await readJson(communityFile, []), ""));
      return;
    }

    sendJson(res, 200, communityActivityForUser(await readJson(communityFile, []), user.id));
    return;
  }

  if (url.pathname === "/api/community" && req.method === "GET") {
    const posts = await readJson(communityFile, []);
    const sort = url.searchParams.get("sort") || "hot";
    const limit = Math.max(1, Math.min(maxCommunityLimit, Number(url.searchParams.get("limit") || defaultCommunityLimit)));
    const items = visiblePosts(posts).sort((a, b) => {
      if (sort === "new") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return hotScore(b) - hotScore(a);
    }).slice(0, limit);
    sendJson(res, 200, items);
    return;
  }

  if (url.pathname === "/api/community" && req.method === "POST") {
    if (!requireWriteCapacity(req, res, "community-write")) return;
    const user = await getEffectiveUser(req);
    if (!user) {
      sendJson(res, 401, { error: "login required" });
      return;
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const post = {
      id: crypto.randomUUID(),
      authorId: user.id,
      name: user.name || "Member",
      profileImage: user.profileImage || "",
      title: cleanText(body.title, 60),
      message: cleanText(body.message, 360),
      image: cleanImage(body.image),
      likes: 0,
      likedBy: [],
      comments: [],
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!post.title || !post.message) {
      sendJson(res, 400, { error: "title and message are required" });
      return;
    }

    await updateJson(communityFile, [], (posts) => {
      posts.push(post);
      return posts.slice(-maxStoredPosts);
    });
    sendJson(res, 201, post);
    return;
  }

  const likeMatch = url.pathname.match(/^\/api\/community\/([^/]+)\/like$/);
  if (likeMatch && req.method === "POST") {
    if (!requireWriteCapacity(req, res, "community-like")) return;
    const user = await getEffectiveUser(req);
    if (!user) {
      sendJson(res, 401, { error: "login required" });
      return;
    }

    let post = null;
    await updateJson(communityFile, [], (storedPosts) => {
      const posts = storedPosts.map(normalizePost);
      post = posts.find((item) => item.id === likeMatch[1]);
      if (!post) return storedPosts;

      if (!post.likedBy.includes(user.id)) {
        post.likedBy.push(user.id);
      }
      post.likes = post.likedBy.length;
      post.updatedAt = new Date().toISOString();
      return posts;
    });
    if (!post) {
      sendJson(res, 404, { error: "post not found" });
      return;
    }

    sendJson(res, 200, post);
    return;
  }

  const commentMatch = url.pathname.match(/^\/api\/community\/([^/]+)\/comments$/);
  if (commentMatch && req.method === "POST") {
    if (!requireWriteCapacity(req, res, "community-write")) return;
    const user = await getEffectiveUser(req);
    if (!user) {
      sendJson(res, 401, { error: "login required" });
      return;
    }

    const body = JSON.parse((await readBody(req)) || "{}");
    const message = cleanText(body.message, 260);
    const parentId = cleanText(body.parentId, 80);
    if (!message) {
      sendJson(res, 400, { error: "message is required" });
      return;
    }

    const comment = {
      id: crypto.randomUUID(),
      authorId: user.id,
      name: user.name || "Member",
      profileImage: user.profileImage || "",
      parentId: parentId || null,
      message,
      image: cleanImage(body.image),
      status: "published",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let postExists = false;
    await updateJson(communityFile, [], (storedPosts) => {
      const posts = storedPosts.map(normalizePost);
      const post = posts.find((item) => item.id === commentMatch[1]);
      if (!post) return storedPosts;
      postExists = true;
      post.comments.push(comment);
      post.updatedAt = comment.updatedAt;
      return posts;
    });
    if (!postExists) {
      sendJson(res, 404, { error: "post not found" });
      return;
    }

    sendJson(res, 201, comment);
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

async function serveStatic(req, res, url) {
  const safePath = path
    .normalize(url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname))
    .replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function start() {
  await loadDotEnv();
  port = Number(process.env.PORT || 4174);
  host = process.env.HOST || "127.0.0.1";
  await ensureJsonFile(communityFile, []);
  await ensureJsonFile(usersFile, []);
  await ensureJsonFile(oauthAccountsFile, []);
  await ensureJsonFile(sessionsFile, []);
  await ensureJsonFile(profilesFile, {});
  await ensureJsonFile(billingFile, []);
  await ensureJsonFile(paymentsFile, []);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, baseUrl());
      if (url.pathname === "/confirm" && req.method === "POST") {
        if (!requireWriteCapacity(req, res, "test-payment-confirm")) return;
        const body = JSON.parse((await readBody(req)) || "{}");
        try {
          const payment = await confirmTestCheckoutPayment({
            paymentKey: String(body.paymentKey || ""),
            orderId: String(body.orderId || ""),
            amount: Number(body.amount),
          });
          sendJson(res, 200, { ok: true, payment });
        } catch (error) {
          sendJson(res, error.status || 502, { error: error.message, details: error.payload || null });
        }
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/health" && req.method === "GET") {
          sendJson(res, 200, { ok: true, uptime: Math.round(process.uptime()), queuedWrites: jsonWriteQueues.size });
          return;
        }
        await handleApi(req, res, url);
        return;
      }
      await serveStatic(req, res, url);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });

  server.maxConnections = Number(process.env.MAX_CONNECTIONS || 500);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;

  server.listen(port, host, () => {
    console.log(`TrendScope server running at http://${host}:${port}`);
  });
}

start();
