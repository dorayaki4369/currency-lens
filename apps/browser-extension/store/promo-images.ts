// Builds the 1280x800 store promo images of every UI locale from the integration and E2E
// review screenshots.
// Usage: node apps/browser-extension/store/promo-images.ts <serve|render>
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { currencies } from "@cl/currency";
import { chromium } from "@playwright/test";
import { promoCopy, type PromoCopy } from "./promo-copy.ts";

const EXTENSION_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REVIEW_SCREENSHOT_DIRECTORY = join(EXTENSION_ROOT, "test/__screenshots__/review");
const OUTPUT_DIRECTORY = join(EXTENSION_ROOT, ".output/store-images");
const FLAG_DIRECTORY = join(EXTENSION_ROOT, "node_modules/flag-icons/flags/4x3");
const CRYPTOCURRENCY_ICON_DIRECTORY = join(
  EXTENSION_ROOT,
  "node_modules/cryptocurrency-icons/svg/color",
);
const PREVIEW_PORT = 4310;
const VIEWPORT = { width: 1280, height: 800 };
/** The store's promotional tiles, which are shared by every locale and so carry no words. */
const PROMO_TILES = {
  "promo-tiles/small-440x280": { width: 440, height: 280 },
  "promo-tiles/marquee-1400x560": { width: 1400, height: 560 },
} as const;
/** The locale whose quick conversion trigger the language-neutral tiles show. */
const PROMO_TILE_LOCALE = "en";

const COPY = promoCopy(currencies.length);

/**
 * Flag regions in descending order of nominal GDP (IMF figures on Wikipedia's "List of countries
 * by GDP (nominal)"), with the euro area placed by its combined GDP and territories left out.
 */
const CATALOG_FLAG_REGIONS = [
  "us",
  "cn",
  "eu",
  "jp",
  "gb",
  "in",
  "ru",
  "br",
  "ca",
  "kr",
  "mx",
  "au",
  "tr",
  "id",
  "sa",
  "ch",
  "pl",
  "ar",
  "il",
  "se",
  "sg",
  "ae",
  "no",
  "th",
  "co",
  "my",
  "vn",
  "bd",
  "ph",
  "dk",
  "za",
  "ro",
  "pk",
  "eg",
  "cz",
  "cl",
  "pe",
  "kz",
  "ng",
  "dz",
] as const;
const CATALOG_CRYPTOCURRENCIES = ["btc", "eth", "xrp", "doge", "ltc", "xmr"] as const;
/** Element symbols and fills of the precious metal marks. */
const CATALOG_METALS = [
  { symbol: "Au", fill: "linear-gradient(135deg,#fde68a,#d4a017 55%,#a16207)" },
  { symbol: "Ag", fill: "linear-gradient(135deg,#f8fafc,#cbd5e1 55%,#94a3b8)" },
  { symbol: "Pt", fill: "linear-gradient(135deg,#f1f5f9,#a8b4c4 55%,#64748b)" },
  { symbol: "Pd", fill: "linear-gradient(135deg,#e7e5e4,#a8a29e 55%,#78716c)" },
] as const;
const LOCALE_COPIES = Object.entries(COPY);

/** Review screenshots each locale's promo images crop, and the test that saves each of them. */
const SOURCE_SCREENSHOTS = {
  "conversion-card": { file: "e2e-{locale}-conversion-card", test: "pnpm test:e2e" },
  popup: { file: "e2e-{locale}-popup", test: "pnpm test:e2e" },
  "quick-conversion": { file: "e2e-{locale}-quick-conversion", test: "pnpm test:e2e" },
} as const;

type SourceScreenshot = keyof typeof SOURCE_SCREENSHOTS;

/** Pixels the E2E test captures around the trigger at 3x, a 16px margin on the page. */
const QUICK_CAPTURE_MARGIN = 48;
/**
 * Supported currencies by kind for the marquee. The cryptocurrency codes mirror
 * `lib/currency-presentation.ts`, and the special drawing right counts as no kind.
 */
const CATALOG_COUNTS = (() => {
  const cryptocurrency = [
    "BTC",
    "BTS",
    "DASH",
    "DOGE",
    "ETH",
    "LD",
    "LTC",
    "NXT",
    "STR",
    "XMR",
    "XRP",
  ];
  const metal = ["XAG", "XAU", "XPD", "XPT"];
  const fiat = currencies.filter(
    ({ code }) => ![...cryptocurrency, ...metal, "XDR"].includes(code),
  ).length;
  return { cryptocurrency: cryptocurrency.length, fiat, metal: metal.length };
})();

/** Pixels above the trigger in its 3x screenshot, where the selected text shows through. */
const QUICK_CONVERSION_TOP = 36;

/** Locales whose headlines keep their authored line breaks at the largest size. */
const CJK_LOCALES: ReadonlySet<string> = new Set(["ja", "ko", "zh-CN", "zh-TW"]);
// Latin headlines take more width per line, so they use a smaller size.
const LATIN_HEADLINE_STYLE = "h1{font-size:54px}";

// The tiles fill their whole area with the brand blue, as the store shows them on light gray.
const TILE_STYLE = `
  *{box-sizing:border-box;margin:0}
  body{position:relative;overflow:hidden;color:#fff;
    font-family:"Helvetica Neue","Noto Sans",system-ui,sans-serif;
    background:radial-gradient(120% 140% at 0% 0%,#38b2ff 0%,transparent 60%),linear-gradient(135deg,#0094ff,#0057d9)}
  .logo{display:flex;align-items:center;justify-content:center;background:#fff;border-radius:28px;
    box-shadow:0 24px 48px -20px rgba(0,30,80,.55)}
  .logo img{width:84px;height:84px}
  .hero{display:flex;align-items:stretch}
  .stack{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start}
  .price{font-weight:800;letter-spacing:-.01em;line-height:1}
  .price mark{display:inline-block;line-height:1.15;background:rgba(255,255,255,.28);color:#fff;padding:0 .12em;border-radius:6px}
`;

// Each locale sets its own font-family, so Han characters keep their Chinese or Japanese forms.
const BASE_STYLE = `
  *{box-sizing:border-box;margin:0}
  body{width:1280px;height:800px;overflow:hidden;color:#0f172a;
    background:radial-gradient(900px 600px at 0% 0%,#e3f1ff 0%,transparent 70%),radial-gradient(800px 600px at 100% 100%,#fff3d1 0%,transparent 70%),#f8fafc}
  .copy{position:absolute;left:80px;top:0;bottom:0;width:440px;display:flex;flex-direction:column;justify-content:center;gap:24px}
  h1{font-size:64px;line-height:1.25;font-weight:800;letter-spacing:-.01em;white-space:nowrap}
  h1 em{font-style:normal;color:#0094ff}
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
    const name = decodeURIComponent(request.url?.slice(1) ?? "");
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
        const page = await browser.newPage({
          viewport: pageSize(name),
          deviceScaleFactor: 1,
        });
        await page.setContent(html, { waitUntil: "load" });
        const path = join(OUTPUT_DIRECTORY, `${name}.png`);
        mkdirSync(dirname(path), { recursive: true });
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
  const missing = LOCALE_COPIES.flatMap(([locale]) =>
    Object.values(SOURCE_SCREENSHOTS)
      .map(({ file, test }) => ({ file: file.replace("{locale}", locale), test }))
      .filter(({ file }) => !existsSync(reviewScreenshotPath(file))),
  );
  if (missing.length > 0) {
    const lines = missing.map(({ file, test }) => `  ${file}.png (run ${test})`);
    throw new Error(`Missing review screenshots:\n${lines.join("\n")}`);
  }
}

/** Lists the promo images at their actual size for checking them side by side. */
function previewIndex(names: string[]): string {
  const frames = names
    .map(
      (name) =>
        `<section><h2><a href="/${name}">${name}</a></h2><iframe src="/${name}" width="${pageSize(name).width}" height="${pageSize(name).height}"></iframe></section>`,
    )
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Store promo images</title>
    <style>body{margin:24px;font-family:system-ui,sans-serif;background:#e2e8f0}section{margin-bottom:32px}
    h2{font-size:14px;margin:0 0 8px}iframe{display:block;border:0;background:#fff}</style></head>
    <body>${frames}</body></html>`;
}

/** Returns the pixel size of a promo image by its key. */
function pageSize(name: string): { readonly width: number; readonly height: number } {
  return Object.entries(PROMO_TILES).find(([tile]) => tile === name)?.[1] ?? VIEWPORT;
}

/**
 * Builds the document of each promo image, keyed by `<locale>/<output file name>` for the
 * screenshots and `promo-tiles/<output file name>` for the promotional tiles.
 */
function promoPages(): Record<string, string> {
  const logo = dataUri(join(EXTENSION_ROOT, "assets/icon.svg"), "image/svg+xml");
  const screenshots = LOCALE_COPIES.flatMap(([locale, copy]): [string, string][] =>
    Object.entries(localePromoPages(locale, copy, logo)).map(
      ([name, body]): [string, string] => [
        `${locale}/${name}`,
        `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${locale}/${name}</title><style>${BASE_STYLE}body{font-family:${copy.fontFamily}}${CJK_LOCALES.has(locale) ? "" : LATIN_HEADLINE_STYLE}</style></head><body>${body}</body></html>`,
      ],
    ),
  );
  const tiles = Object.entries(promoTilePages(logo)).map(
    ([name, body]): [string, string] => [
      name,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${name}</title><style>${TILE_STYLE}</style></head><body style="width:${pageSize(name).width}px;height:${pageSize(name).height}px">${body}</body></html>`,
    ],
  );
  return Object.fromEntries([...screenshots, ...tiles]);
}

/** Builds the body of each promotional tile from the logo and the quick conversion trigger. */
function promoTilePages(logo: string): Record<keyof typeof PROMO_TILES, string> {
  const icon = (path: string, className: string) =>
    `<img class="${className}" src="${dataUri(path, "image/svg+xml")}" alt="">`;
  const fiatSymbols = ["$", "€", "¥"]
    .map((symbol) => `<span class="coin symbol">${symbol}</span>`)
    .join("");
  const coins = ["btc", "eth", "xrp"]
    .map((code) => icon(join(CRYPTOCURRENCY_ICON_DIRECTORY, `${code}.svg`), "coin"))
    .join("");
  const metals = CATALOG_METALS.slice(0, 3)
    .map(
      ({ symbol, fill }) =>
        `<span class="coin metal" style="background:${fill}">${symbol}</span>`,
    )
    .join("");
  const counts = [
    [fiatSymbols, CATALOG_COUNTS.fiat],
    [coins, CATALOG_COUNTS.cryptocurrency],
    [metals, CATALOG_COUNTS.metal],
  ]
    .map(
      ([marks, count]) =>
        `<div class="count"><div class="marks">${marks}</div>${count}</div>`,
    )
    .join("");
  return {
    "promo-tiles/small-440x280": `
      <style>
        body{display:flex;align-items:center;justify-content:center}
        .hero{gap:28px}
        .logo{width:120px;height:120px}
        .price{font-size:44px}
      </style>
      <div class="hero">
        <div class="logo"><img src="${logo}" alt=""></div>
        <div class="stack"><div class="price"><mark>$249.00</mark></div>${tileTrigger(0.6)}</div>
      </div>`,
    "promo-tiles/marquee-1400x560": `
      <style>
        .brand{position:absolute;left:96px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:36px}
        .hero{gap:44px}
        .logo{width:200px;height:200px;border-radius:44px}
        .logo img{width:150px;height:150px}
        .price{font-size:76px}
        .wordmark{font-size:72px;font-weight:800;letter-spacing:-.02em;line-height:1}
        .counts{position:absolute;right:96px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:28px}
        .count{display:flex;align-items:center;gap:28px;font-size:72px;font-weight:800;line-height:1}
        .marks{display:flex;flex:none;width:204px}
        .marks>*{flex:none;margin-right:-12px;box-shadow:0 0 0 4px #0a6ff0,0 10px 24px -10px rgba(0,0,0,.45)}
        .coin{width:68px;height:68px;border-radius:50%}
        .symbol{display:flex;align-items:center;justify-content:center;background:#fff;color:#0057d9;font-size:38px;font-weight:800}
        .metal{display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:rgba(15,23,42,.72)}
      </style>
      <div class="brand">
        <div class="hero">
          <div class="logo"><img src="${logo}" alt=""></div>
          <div class="stack"><div class="price"><mark>$249.00</mark></div>${tileTrigger(1)}</div>
        </div>
        <div class="wordmark">Currency Lens</div>
      </div>
      <div class="counts">${counts}</div>`,
  };
}

/**
 * Shows the quick conversion trigger at the given share of its 3x capture, sized to the
 * trigger itself so it lines up with its neighbors, with the capture margin around it hidden
 * except for the shadow below.
 */
function tileTrigger(scale: number): string {
  const file = SOURCE_SCREENSHOTS["quick-conversion"].file.replace(
    "{locale}",
    PROMO_TILE_LOCALE,
  );
  const path = reviewScreenshotPath(file);
  const png = readFileSync(path);
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
  const margin = QUICK_CAPTURE_MARGIN * scale;
  return `<div style="position:relative;width:${(width - QUICK_CAPTURE_MARGIN * 2) * scale}px;height:${(height - QUICK_CAPTURE_MARGIN * 2) * scale}px">
    <img src="${dataUri(path, "image/png")}" alt="" style="position:absolute;left:-${margin}px;top:-${margin}px;width:${width * scale}px;clip-path:inset(${margin}px 0 0 0)">
  </div>`;
}

/** Builds the body of one locale's promo images, keyed by output file name. */
function localePromoPages(
  locale: string,
  copy: PromoCopy,
  logo: string,
): Record<string, string> {
  const crop = (
    name: SourceScreenshot,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => cropScreenshot(locale, name, x, y, width, height);
  return {
    "promo-1-select-and-convert": selectAndConvertPage(locale, copy, crop),

    "promo-2-currency-catalog": `
      <style>
        .copy{width:480px}
        .catalog{position:absolute;left:640px;top:0;bottom:0;right:0;display:flex;flex-direction:column;justify-content:center;gap:40px}
        .category h2{font-size:18px;font-weight:700;color:#475569;margin-bottom:16px}
        .flags{display:grid;grid-template-columns:repeat(10,56px);gap:12px;
          -webkit-mask-image:linear-gradient(to right,#000 55%,transparent);mask-image:linear-gradient(to right,#000 55%,transparent)}
        .flags img{width:56px;height:42px;border-radius:6px;object-fit:cover;box-shadow:0 0 0 1px rgba(15,23,42,.08),0 6px 14px -8px rgba(15,23,42,.35)}
        .marks{display:flex;gap:16px}
        .marks img,.metal{width:64px;height:64px;border-radius:50%;box-shadow:0 8px 18px -10px rgba(15,23,42,.45)}
        .symbol{display:flex;align-items:center;justify-content:center;background:#fff;color:#0057d9;font-size:38px;font-weight:800}
        .metal{display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:rgba(15,23,42,.72);
          box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 8px 18px -10px rgba(15,23,42,.45)}
      </style>
      <div class="copy">
        ${copyBlock(copy.currencyCatalog)}
      </div>
      <div class="catalog">${currencyCatalog(copy.currencyCatalog.categories)}</div>`,

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
        ${copyBlock(copy.toolbarPopup)}
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
        <div class="popup">${crop("popup", 0, 0, 400, 392)}</div>
      </div>`,
  };
}

/** Renders the headline of one promo image, highlighting its last line. */
function copyBlock(copy: { readonly headline: readonly string[] }): string {
  const lead = copy.headline
    .slice(0, -1)
    .map((line) => `${line}<br>`)
    .join("");
  const highlight = copy.headline.at(-1) ?? "";
  return `<h1>${lead}<em>${highlight}</em></h1>`;
}

/** Tiles flags, cryptocurrency icons, and precious metal marks under their category labels. */
function currencyCatalog([fiat, cryptocurrency, metal]: readonly [
  string,
  string,
  string,
]): string {
  const flags = CATALOG_FLAG_REGIONS.map(
    (region) =>
      `<img src="${dataUri(join(FLAG_DIRECTORY, `${region}.svg`), "image/svg+xml")}" alt="">`,
  ).join("");
  const cryptocurrencies = CATALOG_CRYPTOCURRENCIES.map(
    (code) =>
      `<img src="${dataUri(join(CRYPTOCURRENCY_ICON_DIRECTORY, `${code}.svg`), "image/svg+xml")}" alt="">`,
  ).join("");
  const metals = CATALOG_METALS.map(
    ({ symbol, fill }) => `<span class="metal" style="background:${fill}">${symbol}</span>`,
  ).join("");
  return [
    [fiat, `<div class="flags">${flags}</div>`],
    [cryptocurrency, `<div class="marks">${cryptocurrencies}</div>`],
    [metal, `<div class="marks">${metals}</div>`],
  ]
    .map(
      ([label, items]) => `<section class="category"><h2>${label}</h2>${items}</section>`,
    )
    .join("");
}

/**
 * Builds the first promo image, where an arrow leads from the right end of the quick
 * conversion trigger, whose width follows the locale's amount format, to the card it opens.
 */
function selectAndConvertPage(
  locale: string,
  copy: PromoCopy,
  crop: (
    name: SourceScreenshot,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => string,
): string {
  const triggerFile = SOURCE_SCREENSHOTS["quick-conversion"].file.replace(
    "{locale}",
    locale,
  );
  // The 3x capture keeps a 48px margin on each side, and the page shows it at 85%.
  const triggerRight = 592 + (pngWidth(reviewScreenshotPath(triggerFile)) - 48) * 0.85;
  const arrowStart = Math.round(triggerRight + 12);
  return `
      <style>
        .copy{width:480px}
        .price{position:absolute;left:630px;top:110px;font-size:56px;font-weight:700;letter-spacing:-.01em;line-height:1.2}
        .price mark{background:#b4d5fe;color:inherit;padding:0 2px}
        .quick{position:absolute;left:592px;top:186px;transform:scale(.85);transform-origin:top left}
        .cursor{position:absolute;right:62px;top:70px;width:44px;height:44px;filter:drop-shadow(0 3px 4px rgba(15,23,42,.35))}
        .card{position:absolute;left:880px;top:360px;transform:scale(.78);transform-origin:top left}
        .flow{position:absolute;left:0;top:0;width:1280px;height:800px}
      </style>
      <div class="copy">
        ${copyBlock(copy.selectAndConvert)}
      </div>
      <div class="price"><mark>$249.00</mark></div>
      <svg class="flow" viewBox="0 0 1280 800" fill="none">
        <defs><marker id="head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M1 1 9 5 1 9" stroke="#0094ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
        <path d="M${arrowStart} 237 C ${arrowStart + 70} 237 1040 270 1040 344" stroke="#0094ff" stroke-width="5" stroke-linecap="round" marker-end="url(#head)"/>
      </svg>
      <div class="card">${crop("conversion-card", 256, 219, 384, 353)}</div>
      <div class="quick">
        ${scaledShot(locale, "quick-conversion", QUICK_CONVERSION_TOP)}
        <svg class="cursor" viewBox="0 0 24 24"><path d="M5 3l13 7.5-5.6 1.5 3.4 6.3-2.6 1.4-3.4-6.3L5 17z" fill="#0f172a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>
      </div>
    `;
}

/** Reads the pixel width from a PNG file's header. */
function pngWidth(path: string): number {
  return readFileSync(path).readUInt32BE(16);
}

/**
 * Shows a review screenshot that the E2E test saved already enlarged around one element,
 * cutting off the part above it that the capture margin let in.
 */
function scaledShot(locale: string, name: SourceScreenshot, top: number): string {
  const file = SOURCE_SCREENSHOTS[name].file.replace("{locale}", locale);
  const image = dataUri(reviewScreenshotPath(file), "image/png");
  return `<div style="overflow:hidden"><img src="${image}" alt="" style="display:block;margin-top:-${top}px"></div>`;
}

/** Shows a region of one locale's review screenshot at its native pixel size. */
function cropScreenshot(
  locale: string,
  name: SourceScreenshot,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const file = SOURCE_SCREENSHOTS[name].file.replace("{locale}", locale);
  const image = dataUri(reviewScreenshotPath(file), "image/png");
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
