#!/usr/bin/env node
// render(t) を公開する HTML を 1 コマずつ撮影し、検査・静止画・一覧画像・MP4 を書き出す。
// 依存は Node.js 22 以上（組み込み WebSocket）、Chrome 系ブラウザ、ffmpeg だけで、npm install は不要。
//
// 使い方:
//   node record.mjs inspect <page.html> [--samples 24]
//   node record.mjs stills  <page.html> --at 0,1.5,3 [--out stills]
//   node record.mjs sheet   <page.html> [--count 12] [--out sheet.png]
//   node record.mjs video   <page.html> [--out out.mp4] [--fps 30]
// 共通: [--chrome <path>] で使うブラウザを指定する（環境変数 CHROME_PATH でも可）。
//
// 終了コード: 0 成功、1 ページ側のエラー（例外、console.error、契約違反）、2 使い方や環境の誤り。

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { once } from "node:events";

class UsageError extends Error {}
class PageError extends Error {}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exit(error instanceof PageError ? 1 : 2);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const page = resolve(args.page);
  if (!existsSync(page)) throw new UsageError(`ページが見つかりません: ${page}`);

  const server = await serveDirectory(dirname(page));
  const browser = await launchBrowser(args.chrome);
  try {
    const session = await openPage(
      browser,
      `${server.origin}/${encodeURIComponent(basename(page))}?capture=1`,
    );
    const meta = session.meta;
    if (args.command === "inspect") await inspect(session, args);
    if (args.command === "stills") await stills(session, args);
    if (args.command === "sheet") await sheet(session, args, meta);
    if (args.command === "video") await video(session, args, meta);
    session.throwIfErrors();
  } finally {
    browser.close();
    server.close();
  }
}

function parseArgs(argv) {
  const [command, page, ...rest] = argv;
  const commands = ["inspect", "stills", "sheet", "video"];
  const OPTION_NAMES = ["at", "chrome", "columns", "count", "fps", "out", "samples"];
  if (!commands.includes(command) || !page) {
    throw new UsageError(
      `使い方: node record.mjs <${commands.join("|")}> <page.html> [options]`,
    );
  }
  const options = { command, page, chrome: process.env.CHROME_PATH };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key.startsWith("--") || value === undefined)
      throw new UsageError(`不正な引数です: ${key}`);
    const name = key.slice(2);
    if (!OPTION_NAMES.includes(name)) throw new UsageError(`不明なオプションです: ${key}`);
    options[name] = value;
  }
  return options;
}

// file:// では fetch や module が CORS で止まるため、ページのあるディレクトリを localhost で配信する。
async function serveDirectory(root) {
  // 不正なパーセント符号化やディレクトリへの要求で例外が出ても、撮影全体を止めずに 4xx を返す。
  const server = createServer((req, res) => {
    let file;
    try {
      file = resolve(
        join(root, decodeURIComponent(new URL(req.url, "http://localhost").pathname)),
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
    });
    res.end(readFileSync(file));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close(),
  };
}

function findChrome(explicit) {
  if (explicit) {
    if (!existsSync(explicit))
      throw new UsageError(`指定のブラウザが見つかりません: ${explicit}`);
    return explicit;
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const candidates =
    {
      darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      ],
      linux: [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
      ],
      win32: [
        `${process.env["PROGRAMFILES"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
        `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
      ],
    }[process.platform] ?? [];
  const found = candidates.find((path) => existsSync(path)) ?? findPlaywrightChromium(home);
  if (!found) {
    throw new UsageError(
      "Chrome 系ブラウザが見つかりません。--chrome <path> か環境変数 CHROME_PATH で指定してください。",
    );
  }
  return found;
}

// Playwright が取得済みの Chromium を、インストール済みブラウザがない環境の代替として使う。
function findPlaywrightChromium(home) {
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(home, "Library", "Caches", "ms-playwright"),
    join(home, ".cache", "ms-playwright"),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "ms-playwright"),
  ].filter((dir) => dir && existsSync(dir));
  const executables = [
    ["chrome-mac-arm64", "Chromium.app", "Contents", "MacOS", "Chromium"],
    ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"],
    [
      "chrome-mac-arm64",
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing",
    ],
    [
      "chrome-mac",
      "Google Chrome for Testing.app",
      "Contents",
      "MacOS",
      "Google Chrome for Testing",
    ],
    ["chrome-linux", "chrome"],
    ["chrome-linux64", "chrome"],
    ["chrome-win", "chrome.exe"],
    ["chrome-win64", "chrome.exe"],
  ];
  for (const cache of caches) {
    const revisions = readdirSync(cache)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort()
      .reverse();
    for (const revision of revisions) {
      const hit = executables
        .map((parts) => join(cache, revision, ...parts))
        .find((path) => existsSync(path));
      if (hit) return hit;
    }
  }
  return undefined;
}

async function launchBrowser(explicit) {
  const executable = findChrome(explicit);
  const profile = mkdtempSync(join(tmpdir(), "diagram-animator-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--mute-audio",
      "--force-device-scale-factor=1",
      "--font-render-hinting=none",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  const endpoint = await new Promise((resolveEndpoint, reject) => {
    let log = "";
    const timer = setTimeout(
      () =>
        reject(new UsageError(`ブラウザの起動を待てませんでした: ${executable}\n${log}`)),
      30000,
    );
    child.stderr.on("data", (chunk) => {
      log += chunk;
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolveEndpoint(match[1]);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(
        new UsageError(`ブラウザが終了しました (code ${code}): ${executable}\n${log}`),
      );
    });
  });

  const cdp = await connect(endpoint);
  return {
    cdp,
    close() {
      cdp.close();
      child.kill();
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // ブラウザがプロファイルを掴んだままの場合は一時ディレクトリに残す。
      }
    },
  };
}

async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((ok, fail) => {
    socket.addEventListener("open", ok, { once: true });
    socket.addEventListener(
      "error",
      () => fail(new UsageError("DevTools に接続できません")),
      {
        once: true,
      },
    );
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { ok, fail } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error)
        fail(new Error(`${message.error.message} (${message.error.code})`));
      else ok(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params, sessionId }));
      return new Promise((ok, fail) => pending.set(id, { ok, fail }));
    },
    on(listener) {
      listeners.add(listener);
    },
    close() {
      socket.close();
    },
  };
}

async function openPage(browser, url) {
  const { cdp } = browser;
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const send = (method, params) => cdp.send(method, params, sessionId);

  const errors = [];
  const warnings = [];
  cdp.on((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Runtime.exceptionThrown") {
      const detail = message.params.exceptionDetails;
      errors.push(detail.exception?.description ?? detail.text);
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const text = message.params.args
        .map((arg) => arg.value ?? arg.description ?? "")
        .join(" ");
      if (message.params.type === "error") errors.push(text);
      // Tailwind の CDN 版が毎回出す「本番では使わない」旨の警告は、撮影用途では意図どおりなので出さない。
      if (
        message.params.type === "warning" &&
        !text.includes("browser build of Tailwind CSS")
      )
        warnings.push(text);
    }
  });

  await send("Runtime.enable");
  await send("Page.enable");
  const loaded = new Promise((ok) =>
    cdp.on((m) => m.sessionId === sessionId && m.method === "Page.loadEventFired" && ok()),
  );
  await send("Page.navigate", { url });
  await loaded;

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails)
      throw new PageError(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };

  const meta = await evaluate(`(async () => {
    if (!window.ANIM) throw new Error("window.ANIM がありません。Anim.define() でシーンを登録してください。");
    await document.fonts.ready;
    await window.ANIM.ready;
    const { width, height, duration } = window.ANIM;
    return { width, height, duration, fps: window.ANIM.fps ?? 30 };
  })()`);
  for (const key of ["width", "height", "duration"]) {
    if (!(meta[key] > 0))
      throw new PageError(`ANIM.${key} は正の数にしてください: ${meta[key]}`);
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: meta.width,
    height: meta.height,
    deviceScaleFactor: 1,
    mobile: false,
  });

  return {
    meta,
    errors,
    warnings,
    evaluate,
    async renderAt(t) {
      await evaluate(
        `Promise.resolve(window.ANIM.render(${t})).then(() => window.ANIM.settle?.())`,
      );
    },
    async capture(t, format = "png") {
      await this.renderAt(t);
      const params = format === "jpeg" ? { format, quality: 92 } : { format };
      const { data } = await send("Page.captureScreenshot", {
        ...params,
        optimizeForSpeed: true,
      });
      return Buffer.from(data, "base64");
    },
    throwIfErrors() {
      for (const warning of new Set(warnings)) console.error(`warning: ${warning}`);
      if (errors.length > 0)
        throw new PageError(
          `ページでエラーが発生しました:\n${[...new Set(errors)].join("\n")}`,
        );
    },
  };
}

function sampleTimes(duration, count) {
  const last = Math.max(0, duration - 1 / 30);
  return Array.from({ length: count }, (_, i) =>
    round(count === 1 ? 0 : (last * i) / (count - 1)),
  );
}

function round(t) {
  return Math.round(t * 1000) / 1000;
}

// 時刻を飛ばして描いても破綻しないか（render が t だけで決まるか）と、画面外へのはみ出しを確かめる。
async function inspect(session, args) {
  const times = sampleTimes(session.meta.duration, Number(args.samples ?? 24));
  const overflows = new Map();
  const shuffled = [...times].reverse();
  for (const t of shuffled) {
    await session.renderAt(t);
    const found = await session.evaluate(`(() => {
      const w = window.ANIM.width, h = window.ANIM.height, out = [];
      for (const el of document.querySelectorAll("text, [data-check]")) {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1) {
          out.push((el.textContent || el.tagName).trim().slice(0, 40));
        }
      }
      return out;
    })()`);
    for (const label of found) overflows.set(label, [...(overflows.get(label) ?? []), t]);
  }
  const deterministic = await checkDeterminism(session, times);
  const report = await session.evaluate(`(() => ({
    ...(window.ANIM.inspect ? window.ANIM.inspect() : {}),
  }))()`);
  console.log(
    JSON.stringify(
      {
        ...session.meta,
        frames: Math.ceil(session.meta.duration * Number(args.fps ?? session.meta.fps)),
        sampledTimes: times,
        deterministic,
        overflow: [...overflows].map(([label, at]) => ({ label, at })),
        ...report,
      },
      null,
      2,
    ),
  );
  if (!deterministic.ok)
    throw new PageError(
      `同じ時刻で違う絵になりました: t=${deterministic.mismatchAt.join(", ")}。render(t) が t 以外の状態に依存しています。`,
    );
}

async function checkDeterminism(session, times) {
  const picks = [
    times[Math.floor(times.length / 3)],
    times[Math.floor((times.length * 2) / 3)],
  ];
  const mismatchAt = [];
  for (const t of picks) {
    const first = await session.capture(t);
    await session.renderAt(0);
    await session.renderAt(session.meta.duration);
    const second = await session.capture(t);
    if (!first.equals(second)) mismatchAt.push(t);
  }
  return { ok: mismatchAt.length === 0, checkedAt: picks, mismatchAt };
}

async function stills(session, args) {
  if (!args.at) throw new UsageError("--at 0,1.5,3 のように時刻（秒）を指定してください");
  const out = resolve(args.out ?? "stills");
  mkdirSync(out, { recursive: true });
  for (const t of args.at.split(",").map(Number)) {
    const file = join(out, `t-${t.toFixed(2)}.png`);
    writeFileSync(file, await session.capture(t));
    console.log(file);
  }
}

async function sheet(session, args, meta) {
  const count = Number(args.count ?? 12);
  const columns = Number(
    args.columns ?? Math.ceil(Math.sqrt((count * (16 / 9)) / (meta.width / meta.height))),
  );
  const rows = Math.ceil(count / columns);
  const times = sampleTimes(meta.duration, count);
  const out = resolve(args.out ?? "sheet.png");
  const ffmpeg = startFfmpeg([
    "-f",
    "image2pipe",
    "-c:v",
    "png",
    "-i",
    "-",
    "-vf",
    `scale=${Math.round(1920 / columns)}:-2,tile=${columns}x${rows}:padding=6:color=gray`,
    "-frames:v",
    "1",
    "-update",
    "1",
    out,
  ]);
  for (const t of times) await ffmpeg.write(await session.capture(t));
  await ffmpeg.end();
  console.log(JSON.stringify({ out, columns, rows, times }));
}

async function video(session, args, meta) {
  const fps = Number(args.fps ?? meta.fps);
  const frames = Math.ceil(meta.duration * fps);
  const out = resolve(args.out ?? "out.mp4");
  const ffmpeg = startFfmpeg([
    "-f",
    "image2pipe",
    "-framerate",
    String(fps),
    "-c:v",
    "mjpeg",
    "-i",
    "-",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "18",
    "-preset",
    "medium",
    "-movflags",
    "+faststart",
    out,
  ]);
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    await ffmpeg.write(await session.capture(round(i / fps), "jpeg"));
    if (i % (fps * 5) === 0) process.stderr.write(`\r${i}/${frames} frames`);
  }
  await ffmpeg.end();
  process.stderr.write(`\r${frames}/${frames} frames\n`);
  console.log(
    JSON.stringify({
      out,
      fps,
      frames,
      seconds: meta.duration,
      elapsed: (Date.now() - started) / 1000,
    }),
  );
}

function startFfmpeg(args) {
  const child = spawn(
    process.env.FFMPEG_PATH ?? "ffmpeg",
    ["-y", "-loglevel", "error", ...args],
    {
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
  let log = "";
  child.stderr.on("data", (chunk) => (log += chunk));
  const exited = new Promise((ok, fail) => {
    child.on("error", () =>
      fail(
        new UsageError(
          "ffmpeg を起動できません。PATH に入れるか FFMPEG_PATH で指定してください。",
        ),
      ),
    );
    child.on("exit", (code) =>
      code === 0
        ? ok()
        : fail(new UsageError(`ffmpeg が失敗しました (code ${code}):\n${log}`)),
    );
  });
  return {
    async write(buffer) {
      if (!child.stdin.write(buffer))
        await Promise.race([once(child.stdin, "drain"), exited]);
    },
    async end() {
      child.stdin.end();
      await exited;
    },
  };
}
