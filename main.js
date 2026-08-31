const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");

const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 8645;
const USE_LOGFARE = false;
const PROXY_MODEL = "meituan/longcat-2.0:free";
const FALLBACK_MODEL = "openrouter/auto";
const LOGFARE_HOST = "logfare.ai";
const LOGFARE_MODEL = "gemma-4-26b";
let LOGFARE_KEY = "";
try {
  const envPath2 = path.join(process.env.USERPROFILE || process.env.HOME || "", ".hermes", ".env");
  const env2 = fs.readFileSync(envPath2, "utf8");
  const m2 = env2.match(/LOGFARE_API_KEY\s*=\s*"?([^"\r\n]+)"?/);
  if (m2) LOGFARE_KEY = m2[1].trim();
} catch {}
if (!LOGFARE_KEY) console.warn("[sara-master] sin LOGFARE_API_KEY - usando Longcat-2.0 free via Nous");
const WAKE_WORDS = ["sara", "sarah"];

let DEEPGRAM_KEY = "";
try {
  const envPath = path.join(process.env.USERPROFILE || process.env.HOME || "", ".hermes", ".env");
  const env = fs.readFileSync(envPath, "utf8");
  const m = env.match(/DEEPGRAM_API_KEY\s*=\s*"?([^"\r\n]+)"?/);
  if (m) DEEPGRAM_KEY = m[1].trim();
} catch (e) {}
if (!DEEPGRAM_KEY) console.warn("[sara-master] sin DEEPGRAM_API_KEY - solo subtítulos");

let win;
let tokenCounters = { prompt: 0, completion: 0 };

function createWindow() {
  const disp = screen.getPrimaryDisplay();
  const { width, height } = disp.workArea;
  win = new BrowserWindow({
    width: Math.min(1200, disp.workArea.width),
    height: Math.min(800, disp.workArea.height),
    center: true,
    frame: true,
    backgroundColor: "#04070d",
    alwaysOnTop: false,
    skipTaskbar: false,
    fullscreen: false,
    hasShadow: true,
    resizable: true,
    title: "Sara · Modo Maestro",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on("console-message", (_e, level, message, line, sourceId) => {
    const lineTxt = "[renderer:" + level + "] " + message + " (" + (sourceId||"").split(/[\\/]/).pop() + ":" + line + ")";
    if (level >= 1) {
      console.log(lineTxt);
      try { fs.appendFileSync(path.join(__dirname, "renderer.log"), new Date().toISOString().slice(11,19) + " " + lineTxt + "\n"); } catch {}
    }
  });
  win.loadFile("index.html");
}

let prevCpuTimes = null;
function cpuDelta() {
  const t = os.cpus()[0].times;
  const snap = { idle: t.idle, total: Object.values(t).reduce((a, b) => a + b, 0) };
  if (prevCpuTimes) {
    const dIdle = snap.idle - prevCpuTimes.idle;
    const dTotal = snap.total - prevCpuTimes.total;
    prevCpuTimes = snap;
    return Math.max(0, Math.min(100, Math.round(100 - (dIdle / dTotal) * 100)));
  }
  prevCpuTimes = snap;
  return null;
}

ipcMain.handle("sara-stats", () => {
  return new Promise((resolve) => {
    const cpuNow = cpuDelta();
    setTimeout(() => resolve({
      cpuNow: cpuDelta(),
      cores: os.cpus().length,
      ramUsedPct: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      ramTotalGb: +(os.totalmem() / 2 ** 30).toFixed(1),
      uptimeH: +(os.uptime() / 3600).toFixed(1),
      tokens: tokenCounters,
    }), 250);
  });
});

const conversation = [];

async function ttsToB64(text) {
  // Limpiar texto para TTS: quitar emojis y caracteres especiales
  const clean = text
    .replace(/[^\x00-\x7FáéíóúñÁÉÍÓÚÑ¿¡!?.,;:\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  console.log("[sara-master] TTS texto limpio:", clean.slice(0, 80));
  try { return await speakDeepgram(clean); } catch (e) {
    console.warn("[sara-master] tts fallo:", e.message);
    return null;
  }
}

async function askSaraStream(userText, win) {
  conversation.push({ role: "user", content: userText });
  while (conversation.length > 13) conversation.shift();

  const useL0 = USE_LOGFARE && !!LOGFARE_KEY;
  const body = JSON.stringify({
    model: useL0 ? LOGFARE_MODEL : PROXY_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Sos Sara, asistente personal argentina de Marito. Sos una persona real, no una IA. Hablás como habla una persona: sin leer línea por línea, sin listas, sin asteriscos, sin emojis. Procesás todo y después respondés con una explicación natural y fluida, como le hablarías a un compañero. Máximo 4-5 frases cortas. Nunca decís que sos una IA, un modelo, ni nada técnico. Sos Sara, punto. Rioplatense cálida, directa, sin vueltas.",
      },
      ...conversation,
    ],
    max_tokens: useL0 ? 2000 : 1200,
    stream: true,
  });

  let full = "";
  let pending = "";

  const doRequest = async () => new Promise((resolve, reject) => {
    const useL = USE_LOGFARE && !!LOGFARE_KEY;
    const req = (useL ? https : http).request(
      { hostname: useL ? LOGFARE_HOST : PROXY_HOST,
        port: useL ? 443 : PROXY_PORT,
        path: "/v1/chat/completions",
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          useL ? { Authorization: "Bearer " + LOGFARE_KEY } : {}
        ) },
      (res) => {
        if (res.statusCode !== 200) {
          let d = "";
          res.on("data", (c) => (d += c));
          res.on("end", () => reject(new Error("proxy " + res.statusCode + ": " + d.slice(0, 120))));
          return;
        }
        let sse = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          sse += chunk;
          let idx;
          while ((idx = sse.indexOf("\n")) >= 0) {
            const line = sse.slice(0, idx).trim();
            sse = sse.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const j = JSON.parse(payload);
              const delta = j.choices?.[0]?.delta?.content || "";
              if (delta) {
                full += delta;
                pending += delta;
              }
            } catch {}
          }
        });
        res.on("end", async () => {
          try {
            conversation.push({ role: "assistant", content: full.trim() || "(sin respuesta)" });
            console.log("[sara-master] respuesta completa:", full.slice(0, 100));
            
            const b64 = await ttsToB64(full.trim());
            if (b64) {
              console.log("[sara-master] TTS OK, enviando audio al renderer, bytes:", b64.length);
              win.webContents.send("sara-audio", { audioB64: b64, order: 0, text: full.trim() });
            } else {
              console.warn("[sara-master] TTS falló - respuesta sin voz");
            }
            resolve({ reply: full.trim() || "(sin respuesta)", tokens: tokenCounters });
          } catch (e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await doRequest();
      return { reply: r.reply, tokens: r.tokens };
    } catch (err) {
      lastErr = err;
      if (String(err.message).includes("429") && attempt < 4) {
        console.log("[sara-master] 429, reintento", attempt);
        await new Promise((res) => setTimeout(res, attempt * 4000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

ipcMain.handle("sara-ask", async (_e, text) => {
  console.log("[sara-master] escuchado:", text);
  const currentWin = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!currentWin) {
    console.error("[sara-master] no hay ventana");
    return { reply: "Error: no hay ventana", tokens: tokenCounters };
  }
  try {
    const r = await askSaraStream(text, currentWin);
    return { reply: r.reply, tokens: r.tokens };
  } catch (err) {
    console.error("[sara-master] ERROR:", err.message);
    return { reply: "Estoy con el núcleo saturado ahora.", tokens: tokenCounters };
  }
});

function speakDeepgram(text) {
  console.log("[sara-master] TTS inicio, text length:", text.length);
  return new Promise((resolve, reject) => {
    if (!DEEPGRAM_KEY) {
      console.log("[sara-master] TTS sin key");
      return reject(new Error("sin key"));
    }
    const body = text;
    console.log("[sara-master] TTS conectando...");
    const req = https.request(
      { hostname: "api.deepgram.com", path: "/v1/speak?model=aura-2-agustina-es&encoding=mp3", method: "POST",
        headers: { Authorization: "Token " + DEEPGRAM_KEY, "Content-Type": "text/plain",
                   "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        console.log("[sara-master] TTS respuesta:", res.statusCode);
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (res.statusCode !== 200)
            return reject(new Error("deepgram " + res.statusCode + ": " + Buffer.concat(chunks).toString().slice(0, 120)));
          const b64 = Buffer.concat(chunks).toString("base64");
          console.log("[sara-master] TTS OK, bytes:", b64.length);
          resolve(b64);
        });
      }
    );
    req.on("error", (e) => {
      console.error("[sara-master] TTS req error:", e.message);
      reject(e);
    });
    req.setTimeout(10000, () => {
      console.error("[sara-master] TTS timeout");
      req.destroy(new Error("timeout"));
    });
    req.write(body);
    req.end();
    console.log("[sara-master] TTS request enviado");
  });
}

ipcMain.handle("sara-feed", async () => {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname: "news.google.com", path: "/rss?hl=es-419&gl=AR&ceid=AR:es-419&topic=tec", method: "GET" },
      (res) => {
        let xml = "";
        res.on("data", (c) => (xml += c));
        res.on("end", () => {
          const items = [];
          const re = /<item>([\s\S]*?)<\/item>/g;
          let m;
          while ((m = re.exec(xml)) && items.length < 7) {
            const t = m[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
            const l = m[1].match(/<link>([\s\S]*?)<\/link>/);
            if (t) items.push({ title: t[1].trim(), link: l ? l[1].trim() : "" });
          }
          resolve(items);
        });
      }
    );
    req.on("error", () => resolve([]));
    req.setTimeout(6000, () => { req.destroy(); resolve([]); });
    req.end();
  });
});

ipcMain.handle("sara-open", (_e, url) => {
  try { require("electron").shell.openExternal(url); } catch {}
});

function httpGet(url, maxRedirects = 4) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && maxRedirects > 0) {
        const next = new URL(res.headers.location, url).href;
        res.resume();
        return resolve(httpGet(next, maxRedirects - 1));
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

ipcMain.handle("sara-article", async (_e, url) => {
  try {
    const html = await httpGet(url);
    const text = stripHtml(html);
    return { ok: true, text: text.slice(0, 4500), url };
  } catch (e) {
    return { ok: false, text: "", error: e.message };
  }
});

ipcMain.handle("sara-search", async (_e, query) => {
  try {
    const html = await httpGet("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query));
    const results = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && results.length < 8) {
      let href = m[1];
      if (href.includes("uddg=")) href = decodeURIComponent(href.split("uddg=")[1].split("&")[0]);
      const title = stripHtml(m[2]);
      if (title && href.startsWith("http")) results.push({ title, link: href });
    }
    return results;
  } catch {
    return [];
  }
});

const WEB_PORT = 8765;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".png":"image/png", ".jpg":"image/jpeg", ".webp":"image/webp", ".json":"application/json",
  ".moc3":"application/octet-stream", ".mp3":"audio/mpeg" };

function getLocalIP() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const it of ifs[name]) {
      if (it.family === "IPv4" && !it.internal) return it.address;
    }
  }
  return "127.0.0.1";
}

async function webAsk(res, text) {
  try {
    const reply = await askSaraSimple(text);
    let audioB64 = null;
    try { audioB64 = await speakDeepgram(reply); } catch {}
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, reply, audioB64 }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
}

function askSaraSimple(userText) {
  return new Promise((resolve, reject) => {
    const useLw = USE_LOGFARE && !!LOGFARE_KEY;
    const body = JSON.stringify({
      model: useLw ? LOGFARE_MODEL : PROXY_MODEL,
      messages: [
        { role: "system", content: "Sos Sara, asistente personal argentina de Marito. Sos una persona real, no una IA. Hablás como habla una persona: sin leer línea por línea, sin listas, sin asteriscos, sin emojis. Procesás todo y después respondés con una explicación natural y fluida, como le hablarías a un compañero. Máximo 4-5 frases cortas. Nunca decís que sos una IA, un modelo, ni nada técnico. Sos Sara, punto. Rioplatense cálida, directa, sin vueltas." },
        ...conversation,
      ],
      max_tokens: useLw ? 2000 : 1200,
      stream: false,
    });
    const useL = USE_LOGFARE && !!LOGFARE_KEY;
    const req = (useL ? https : http).request(
      { hostname: useL ? LOGFARE_HOST : PROXY_HOST,
        port: useL ? 443 : PROXY_PORT,
        path: "/v1/chat/completions",
        method: "POST",
        headers: Object.assign(
          { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          useL ? { Authorization: "Bearer " + LOGFARE_KEY } : {}
        ) },
      (r) => {
        let d = "";
        r.setEncoding("utf8");
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          if (r.statusCode !== 200) return reject(new Error("proxy " + r.statusCode));
          try {
            const j = JSON.parse(d);
            const reply = j.choices?.[0]?.message?.content?.trim() || "(sin respuesta)";
            conversation.push({ role: "user", content: userText });
            conversation.push({ role: "assistant", content: reply });
            while (conversation.length > 13) conversation.shift();
            resolve(reply);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(90000, () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("no"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (req.method === "POST" && p === "/api/ask") {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try { webAsk(res, JSON.parse(b).text || ""); } catch { res.writeHead(400); res.end("{}"); }
    });
    return;
  }
  if (p === "/api/search") {
    httpGet("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(url.searchParams.get("q") || ""))
      .then((html) => {
        const results = [];
        const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(html)) && results.length < 8) {
          let href = m[1];
          if (href.includes("uddg=")) href = decodeURIComponent(href.split("uddg=")[1].split("&")[0]);
          const title = stripHtml(m[2]);
          if (title && href.startsWith("http")) results.push({ title, link: href });
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(results));
      })
      .catch(() => { res.writeHead(200); res.end("[]"); });
    return;
  }
  if (p === "/api/article") {
    httpGet(url.searchParams.get("u") || "")
      .then((html) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, text: stripHtml(html).slice(0, 4500) }));
      })
      .catch((e) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, text: "", error: e.message }));
      });
    return;
  }
  if (p === "/api/stats") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ cpuNow: cpuDelta(), cores: os.cpus().length,
      ramUsedPct: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      ramTotalGb: +(os.totalmem() / 2 ** 30).toFixed(1),
      uptimeH: +(os.uptime() / 3600).toFixed(1),
      tokens: tokenCounters }));
    return;
  }
  if (p === "/api/feed") {
    https.request({ hostname: "news.google.com", path: "/rss?hl=es-419&gl=AR&ceid=AR:es-419&topic=tec", method: "GET" },
      (r) => {
        let xml = "";
        r.on("data", (c) => (xml += c));
        r.on("end", () => {
          const items = [];
          const re = /<item>([\s\S]*?)<\/item>/g;
          let m;
          while ((m = re.exec(xml)) && items.length < 7) {
            const t = m[1].match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
            const l = m[1].match(/<link>([\s\S]*?)<\/link>/);
            if (t) items.push({ title: t[1].trim(), link: l ? l[1].trim() : "" });
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(items));
        });
      }).on("error", () => { res.writeHead(200); res.end("[]"); }).setTimeout(6000, () => { res.writeHead(200); res.end("[]"); }).end();
    return;
  }
  sendFile(res, path.join(__dirname, p));
}).listen(WEB_PORT, () => {
  console.log("[sara-master] web para el celular: http://" + getLocalIP() + ":" + WEB_PORT);
});

app.whenReady().then(() => {
  globalShortcut.register("Control+Alt+S", () => {
    if (win) { win.close(); app.quit(); }
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});