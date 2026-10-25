// Builds the 1280x800 store promo images from the integration and E2E review screenshots.
// Usage: node apps/browser-extension/store/promo-images.ts <serve|render>
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { currencies } from "@cl/currency";
import { chromium } from "@playwright/test";

const EXTENSION_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_SCREENSHOT_DIRECTORY = join(EXTENSION_ROOT, "test/__screenshots__/review");
const OUTPUT_DIRECTORY = join(EXTENSION_ROOT, ".output/store-images");
const PREVIEW_PORT = 4310;
const VIEWPORT = { width: 1280, height: 800 };

/** Review screenshots the promo images crop, and the test that saves each of them. */
const SOURCE_SCREENSHOTS = {
  "e2e-conversion-card": "pnpm test:e2e",
  "e2e-popup": "pnpm test:e2e",
  "popup-light-target-picker": "pnpm test:integration",
} as const;

type SourceScreenshot = keyof typeof SOURCE_SCREENSHOTS;

// Hiragino covers macOS and Noto Sans CJK JP covers the Ubuntu runner, so CI keeps Japanese glyphs.
const BASE_STYLE = `
  *{box-sizing:border-box;margin:0}
  body{width:1280px;height:800px;overflow:hidden;color:#0f172a;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP",system-ui,sans-serif;
    background:radial-gradient(900px 600px at 0% 0%,#e3f1ff 0%,transparent 70%),radial-gradient(800px 600px at 100% 100%,#fff3d1 0%,transparent 70%),#f8fafc}
  .copy{position:absolute;left:80px;top:0;bottom:0;width:440px;display:flex;flex-direction:column;justify-content:center;gap:24px}
  .brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:22px;letter-spacing:.01em}
  .brand img{width:44px;height:44px}
  h1{font-size:46px;line-height:1.3;font-weight:800;letter-spacing:-.01em}
  h1 em{font-style:normal;color:#0094ff}
  p{font-size:19px;line-height:1.75;color:#475569}
  ul{list-style:none;padding:0;display:grid;gap:12px;font-size:17px;color:#334155}
  li{display:flex;gap:10px;align-items:center}
  li::before{content:"";width:22px;height:22px;border-radius:50%;flex:none;
    background:#0094ff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 12.5l4 4 8-9'/%3E%3C/svg%3E") center/14px no-repeat}
  .shot{border-radius:14px;box-shadow:0 30px 60px -20px rgba(15,23,42,.35),0 0 0 1px rgba(15,23,42,.08);flex:none}
  .label{font-size:14px;font-weight:600;color:#64748b;text-align:center;margin-top:14px}
`;

const [command] = process.argv.slice(2);
if (command === "serve") {
  servePromoImages();
} else if (command === "render") {
  await renderPromoImages();
} else {
  throw new Error(
    "Usage: node apps/browser-extension/store/promo-images.ts <serve|render>",
  );
}

/** Serves every promo image as a page, rebuilt per request to pick up new screenshots. */
function servePromoImages(): void {
  requireSourceScreenshots();
  createServer((request, response) => {
    const name = request.url?.slice(1) ?? "";
    const pages = promoPages();
    const html = name === "" ? previewIndex(Object.keys(pages)) : pages[name];
    if (html === undefined) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  }).listen(PREVIEW_PORT, "127.0.0.1", () => {
    console.log(`Store promo images: http://127.0.0.1:${PREVIEW_PORT}/`);
  });
}

/** Writes every promo image as a PNG into the extension build output. */
async function renderPromoImages(): Promise<void> {
  requireSourceScreenshots();
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  const browser = await chromium.launch();
  try {
    const paths = await Promise.all(
      Object.entries(promoPages()).map(async ([name, html]) => {
        const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: "load" });
        const path = join(OUTPUT_DIRECTORY, `${name}.png`);
        await page.screenshot({ path });
        return path;
      }),
    );
    console.log(paths.join("\n"));
  } finally {
    await browser.close();
  }
}

/** Fails with the test to run when a review screenshot has not been saved yet. */
function requireSourceScreenshots(): void {
  const missing = Object.entries(SOURCE_SCREENSHOTS).filter(
    ([name]) => !existsSync(reviewScreenshotPath(name)),
  );
  if (missing.length > 0) {
    const lines = missing.map(
      ([name, testCommand]) => `  ${name}.png (run ${testCommand})`,
    );
    throw new Error(`Missing review screenshots:\n${lines.join("\n")}`);
  }
}

/** Lists the promo images at their actual size for checking them side by side. */
function previewIndex(names: string[]): string {
  const frames = names
    .map(
      (name) =>
        `<section><h2><a href="/${name}">${name}</a></h2><iframe src="/${name}" width="${VIEWPORT.width}" height="${VIEWPORT.height}"></iframe></section>`,
    )
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Store promo images</title>
    <style>body{margin:24px;font-family:system-ui,sans-serif;background:#e2e8f0}section{margin-bottom:32px}
    h2{font-size:14px;margin:0 0 8px}iframe{display:block;border:0;background:#fff}</style></head>
    <body>${frames}</body></html>`;
}

/** Builds the document of each promo image, keyed by its output file name. */
function promoPages(): Record<string, string> {
  const logo = dataUri(join(EXTENSION_ROOT, "assets/icon.svg"), "image/svg+xml");
  const brand = `<div class="brand"><img src="${logo}" alt="">Currency Lens</div>`;
  const pages = {
    "promo-1-select-and-convert": `
      <style>
        .copy{width:480px}
        .stage{position:absolute;left:680px;top:0;bottom:0;right:80px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
        .price{font-size:52px;font-weight:700;letter-spacing:-.01em;line-height:1.2}
        .price mark{background:#b4d5fe;color:inherit;padding:0 1px}
        .card{margin-top:20px;margin-left:56px}
      </style>
      <div class="copy">
        ${brand}
        <h1>選択した金額を、<br><em>その場で換算。</em></h1>
        <p>海外サイトの価格を選択して、ボタンを押すだけ。<br>ページを離れずに、いつもの通貨で確かめられます。</p>
        <ul><li>${currencies.length}の通貨に対応</li><li>1時間ごとに更新される最新レートで換算</li><li>最大5通貨へ一度に換算</li><li>「$」「USD」「円」のどの書き方の金額も検出</li></ul>
      </div>
      <div class="stage">
        <div class="price"><mark>$249.00</mark></div>
        <div class="card">${crop("e2e-conversion-card", 256, 219, 384, 400)}</div>
      </div>`,

    "promo-2-currency-picker": `
      <style>
        .copy{width:480px}
        .stage{position:absolute;left:640px;top:0;bottom:0;right:0;display:flex;align-items:center;justify-content:center}
      </style>
      <div class="copy">
        ${brand}
        <h1>${currencies.length}の通貨から、<br><em>換算先を選べる。</em></h1>
        <p>通貨コード、通貨名、地域名で検索して、換算先を最大5通貨まで登録できます。法定通貨のほか、暗号資産や貴金属にも換算できます。</p>
        <ul><li>ビットコイン、イーサリアムなどの暗号資産にも対応</li><li>金・銀・プラチナ・パラジウムにも対応</li><li>「$」「¥」がどの通貨を指すかも設定可能</li></ul>
      </div>
      <div class="stage">${crop("popup-light-target-picker", 0, 0, 321, 600)}</div>`,

    "promo-3-toolbar-popup": `
      <style>
        .copy{width:460px}
        .window{position:absolute;left:600px;top:120px;width:640px;height:560px}
        .chrome{position:absolute;inset:0;background:#fff;border-radius:16px;overflow:hidden;
          box-shadow:0 40px 80px -24px rgba(15,23,42,.35),0 0 0 1px rgba(15,23,42,.08);
          -webkit-mask-image:linear-gradient(to right,transparent,#000 140px);mask-image:linear-gradient(to right,transparent,#000 140px)}
        .toolbar{height:48px;background:#f8fafc;display:flex;align-items:center;gap:6px;padding:0 12px;border-bottom:1px solid #e2e8f0}
        .icon{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
        .icon svg{width:18px;height:18px;fill:none;stroke:#475569;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
        .icon img{width:20px;height:20px}
        .icon.active{background:#dbeafe}
        .avatar{width:24px;height:24px;border-radius:50%;background:#94a3b8;margin:0 4px}
        .url{flex:1;height:34px;border-radius:17px;background:#e2e8f0;margin-right:6px}
        .content{padding:32px 40px;display:grid;gap:14px}
        .line{height:14px;border-radius:7px;background:#f1f5f9}
        .popup{position:absolute;left:156px;top:52px}
        .popup .shot{border-radius:10px;box-shadow:0 20px 50px -12px rgba(15,23,42,.4),0 0 0 1px rgba(15,23,42,.1)}
      </style>
      <div class="copy">
        ${brand}
        <h1>ツールバーから、<br><em>いつでも換算。</em></h1>
        <p>金額を入力するだけで、<br>登録した通貨へまとめて換算します。</p>
      </div>
      <div class="window">
        <div class="chrome">
          <div class="toolbar">
            <span class="url"></span>
            <span class="icon active"><img src="${logo}" alt=""></span>
            <span class="icon"><svg viewBox="0 0 24 24"><path d="M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"/><rect x="14" y="2" width="8" height="8" rx="1"/></svg></span>
            <span class="avatar"></span>
          </div>
          <div class="content">
            <div class="line" style="width:60%;height:22px"></div><div class="line"></div><div class="line" style="width:90%"></div>
            <div class="line" style="width:75%"></div><div class="line" style="width:40%"></div>
          </div>
        </div>
        <div class="popup">${crop("e2e-popup", 0, 0, 400, 440)}</div>
      </div>`,
  };
  return Object.fromEntries(
    Object.entries(pages).map(([name, body]) => [
      name,
      `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${name}</title><style>${BASE_STYLE}</style></head><body>${body}</body></html>`,
    ]),
  );
}

/** Shows a region of a review screenshot at its native pixel size. */
function crop(name: SourceScreenshot, x: number, y: number, width: number, height: number) {
  const image = dataUri(reviewScreenshotPath(name), "image/png");
  return `<div class="shot" style="width:${width}px;height:${height}px;background:url('${image}') -${x}px -${y}px no-repeat"></div>`;
}

/** Returns where the integration or E2E test saves a review screenshot. */
function reviewScreenshotPath(name: string): string {
  return join(REVIEW_SCREENSHOT_DIRECTORY, `${name}.png`);
}

/** Inlines a local file so the page renders without serving other files. */
function dataUri(path: string, type: string): string {
  return `data:${type};base64,${readFileSync(path).toString("base64")}`;
}
