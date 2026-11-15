const fs = require("node:fs");
const path = require("node:path");
const authHandler = require("./auth");

const LOGIN_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#160f0b">
  <title>Acesso privado — Santuário Literário</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=Lora:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { min-height:100vh; display:grid; place-items:center; margin:0; padding:22px; color:#f5ebd9; font-family:Lora,Georgia,serif; background:radial-gradient(ellipse at 50% 5%,rgba(116,72,39,.28),transparent 48%),repeating-linear-gradient(90deg,rgba(255,255,255,.012) 0,rgba(255,255,255,.012) 2px,transparent 2px,transparent 7px),linear-gradient(135deg,#160f0b,#241710 48%,#130d09); }
    .card { width:min(440px,100%); padding:30px; border:1px solid rgba(197,160,89,.65); background:linear-gradient(145deg,rgba(57,38,25,.98),rgba(25,17,12,.99)); box-shadow:0 18px 48px rgba(0,0,0,.5),inset 0 0 0 5px rgba(197,160,89,.06); }
    .ornament { text-align:center; color:#c5a059; font-size:1.5rem; }
    h1 { margin:8px 0; color:#c5a059; text-align:center; font:600 clamp(1.35rem,5vw,1.8rem) Cinzel,Georgia,serif; }
    p { margin:8px 0 22px; color:#d9c7a6; text-align:center; font:italic 1.15rem "Cormorant Garamond",Georgia,serif; }
    label { display:block; margin-bottom:7px; color:#eadcc4; font-size:.9rem; }
    input { width:100%; min-height:45px; padding:10px 12px; color:#2c221e; background:linear-gradient(135deg,#f8efdf,#e8d8ba); border:1px solid #9c793f; border-radius:2px; font:inherit; }
    input:focus { outline:2px solid #e0c47d; outline-offset:2px; }
    button { width:100%; margin-top:17px; padding:11px; color:#f8edd8; font:600 .9rem Cinzel,Georgia,serif; border:1px solid #d5b66e; border-radius:3px; background:linear-gradient(145deg,#b38c48,#74542b 52%,#a67c3c); box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 5px 13px rgba(0,0,0,.4); cursor:pointer; }
    button:disabled { opacity:.65; cursor:wait; }
    .error { min-height:1.4em; margin:12px 0 0; color:#f5c2a8; font-size:.88rem; text-align:center; }
  </style>
</head>
<body>
  <main class="card">
    <div class="ornament" aria-hidden="true">❧</div>
    <h1>O Santuário do Eremita Literário</h1>
    <p>Esta biblioteca é reservada. Informe sua senha para entrar.</p>
    <form id="login-form">
      <label for="password">Senha de acesso</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <button id="submit" type="submit">Abrir a biblioteca</button>
      <div class="error" id="error" role="alert" aria-live="polite"></div>
    </form>
  </main>
  <script>
    const form = document.getElementById("login-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("submit");
      const error = document.getElementById("error");
      button.disabled = true;
      error.textContent = "";
      try {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: document.getElementById("password").value })
        });
        if (response.ok) {
          window.location.replace("/");
          return;
        }
        const result = await response.json().catch(() => ({}));
        error.textContent = result.error || "Não foi possível autenticar. Tente novamente.";
      } catch {
        error.textContent = "Falha de conexão. Verifique a rede e tente novamente.";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;

function hasSession(req) {
  return new Promise((resolve) => {
    const mockResponse = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {
        resolve(this.statusCode === 200);
      },
      end() {
        resolve(this.statusCode >= 200 && this.statusCode < 300);
      },
    };
    const sessionRequest = { ...req, method: "GET" };
    authHandler(sessionRequest, mockResponse);
  });
}

module.exports = async function gateHandler(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!(await hasSession(req))) {
    return res.status(200).send(LOGIN_PAGE);
  }

  try {
    const appHtml = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    return res.status(200).send(appHtml);
  } catch (error) {
    console.error("Could not load the reading tracker HTML:", error);
    return res.status(500).send("Não foi possível carregar o aplicativo.");
  }
};

module.exports.config = {
  includeFiles: "index.html",
};
