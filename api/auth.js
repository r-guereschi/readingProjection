const {
  createHash,
  createHmac,
  timingSafeEqual,
} = require("node:crypto");

const COOKIE_NAME = "santuario_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(payload);
}

function safeEqual(left, right) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return "";
}

function makeSession(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(expiresAt);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function isValidSession(req, secret) {
  const token = getCookie(req, COOKIE_NAME);
  const separator = token.indexOf(".");
  if (separator < 1) return false;

  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(
    createHmac("sha256", secret).update(String(expiresAt)).digest("base64url")
  );
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

module.exports = function authHandler(req, res) {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret || Buffer.byteLength(secret) < 32) {
    return sendJson(res, 503, {
      error: "Autenticação não configurada. Defina APP_PASSWORD e SESSION_SECRET na Vercel.",
    });
  }

  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    return sendJson(res, isValidSession(req, secret) ? 200 : 401, {
      authenticated: isValidSession(req, secret),
    });
  }

  if (req.method === "POST") {
    const suppliedPassword =
      req.body && typeof req.body.password === "string" ? req.body.password : "";
    if (!safeEqual(suppliedPassword, password)) {
      return sendJson(res, 401, { error: "A senha não confere." });
    }

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${makeSession(secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`
    );
    return res.status(204).end();
  }

  if (req.method === "DELETE") {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure`
    );
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return sendJson(res, 405, { error: "Método não permitido." });
};
