// Genera el carrusel "Así se ven 100 calorías" (1080×1350, 4:5) en PNG.
// Fotos a sangre ocupando toda la slide y texto mínimo encima.
// Uso: python3 content/carruseles/100-calorias/editar_fotos.py && node content/carruseles/100-calorias/generar.mjs
// Estilo: DESIGN.md (Carbón, Verde Bosque; Sora + Inter).
import { chromium } from "playwright-core";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const out = join(here, "png");
mkdirSync(out, { recursive: true });

// Fuentes y fotos embebidas: setContent() no puede cargar file:// desde about:blank.
const font = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(join(root, "node_modules/@fontsource-variable", pkg, "files", file)).toString("base64")}`;
const img = (name) => {
  const file = join(here, "fotos", "editadas", `${name}.jpg`);
  if (!existsSync(file)) throw new Error(`Falta ${file}: ejecuta primero editar_fotos.py`);
  return `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;
};

const BRAND = "ayala.fit";
const CHAT = `<svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="29" fill="#12B76A"/><path d="M18 20h22a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H28l-7 6v-6h-3a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" fill="none" stroke="#1B1C1E" stroke-width="3" stroke-linejoin="round"/><path d="M22 28h14M22 33h9" stroke="#1B1C1E" stroke-width="3" stroke-linecap="round"/></svg>`;

// Kcal aproximadas (tablas BEDCA/USDA, valores redondeados).
const comparisons = [
  { top: { food: "aceite", amount: "11 g", name: "Aceite de oliva" }, bottom: { food: "fresas", amount: "310 g", name: "Fresas" } },
  { top: { food: "almendras", amount: "14", name: "Almendras" }, bottom: { food: "manzana", amount: "1", name: "Manzana grande" } },
  { top: { food: "chocolate", amount: "17 g", name: "Chocolate 70%" }, bottom: { food: "sandia", amount: "330 g", name: "Sandía" } },
  { top: { food: "refresco", amount: "240 ml", name: "Refresco" }, bottom: { food: "palomitas", amount: "3", name: "Tazas de palomitas" } },
  {
    equal: true, // las dos opciones son igual de buenas: ambas en verde
    top: { food: "pollo", amount: "85 g", name: "Pechuga de pollo", sub: "≈ 20 g de proteína" },
    bottom: { food: "claras", amount: "6", name: "Claras de huevo", sub: "≈ 21 g de proteína" },
  },
];

const css = `
@font-face { font-family: Sora; src: url(${font("sora", "sora-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 800; }
@font-face { font-family: Inter; src: url(${font("inter", "inter-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 900; }
:root { --ink:#1B1C1E; --ink-soft:#57574F; --bg:#FAF8F3; --green:#12B76A; --green-deep:#0A6E42; --coral:#F2765C; --coral-deep:#B23A22; }
* { box-sizing:border-box; margin:0; padding:0; }
html,body { width:1080px; height:1350px; background:var(--bg); }
body { color:var(--ink); font-family:Inter,sans-serif; -webkit-font-smoothing:antialiased; }
.slide { position:relative; width:1080px; height:1350px; overflow:hidden; }
.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.brand { position:absolute; left:72px; bottom:40px; font:500 19px/1 Inter; letter-spacing:.22em; text-transform:uppercase; color:rgba(27,28,30,.38); }

/* Comparativa: dos fotos a sangre, una encima de otra */
.half { position:absolute; left:0; width:1080px; height:675px; overflow:hidden; }
.half.t { top:0; } .half.b { top:675px; }
.half img { width:100%; height:100%; object-fit:cover; display:block; }
.half .txt { position:absolute; left:72px; top:64px; }
.half.b .txt { top:92px; }
.name { display:flex; align-items:center; gap:12px; font:600 23px/1 Inter; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-soft); }
.name::before { content:""; width:12px; height:12px; border-radius:50%; background:var(--coral); }
.half.b .name::before, .equal .half .name::before { background:var(--green); }
.amt { font:700 150px/.92 Sora; letter-spacing:-.05em; margin-top:18px; color:var(--coral-deep); }
.half.b .amt, .equal .half .amt { color:var(--green-deep); }
.sub { font:500 26px/1.2 Inter; color:var(--ink-soft); margin-top:16px; }
.seam { position:absolute; left:50%; top:675px; transform:translate(-50%,-50%); background:var(--green); color:var(--ink); font:700 30px/1 Sora; letter-spacing:-.01em; padding:20px 34px; border-radius:999px; box-shadow:0 10px 30px rgba(27,28,30,.18); white-space:nowrap; }
.divider { position:absolute; left:0; right:0; top:675px; height:1px; background:rgba(27,28,30,.08); }

/* Portada */
.cover .head { position:absolute; left:72px; top:92px; }
.cover .l1 { font:700 88px/1 Sora; letter-spacing:-.04em; }
.cover .l2 { position:relative; display:inline-block; font:800 236px/.86 Sora; letter-spacing:-.06em; color:var(--green-deep); margin-top:10px; z-index:0; }
.cover .l2::after { content:""; position:absolute; left:-6px; right:-6px; bottom:-4px; height:34px; border-radius:10px; background:var(--coral); opacity:.55; z-index:-1; }
.cover .l3 { font:400 32px/1.35 Inter; color:var(--ink-soft); margin-top:30px; }

/* Resumen y CTA */
.msg .head { position:absolute; left:72px; right:72px; top:96px; }
.msg h2 { font:700 96px/1.02 Sora; letter-spacing:-.045em; }
.msg h2 em { position:relative; font-style:normal; color:var(--green-deep); z-index:0; white-space:nowrap; }
.msg h2 em::after { content:""; position:absolute; left:-4px; right:-4px; bottom:8px; height:22px; border-radius:8px; background:var(--coral); opacity:.5; z-index:-1; }
.msg p { font:400 32px/1.45 Inter; color:var(--ink-soft); margin-top:30px; max-width:780px; }
.comment { display:inline-flex; align-items:center; gap:22px; margin-top:44px; background:var(--green-deep); color:#fff; padding:26px 40px 26px 30px; border-radius:26px; box-shadow:0 14px 34px rgba(10,110,66,.22); }
.comment svg { width:58px; height:58px; flex:none; }
.comment b { display:block; font:700 46px/1 Sora; letter-spacing:-.02em; }
.comment b span { color:#fff; background:var(--coral-deep); padding:2px 14px 6px; border-radius:10px; margin-left:6px; }
.comment small { display:block; font:500 25px/1.2 Inter; color:#CFEBDD; margin-top:10px; }
`;

const page = (body, cls = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="slide ${cls}">${body}<div class="brand">${BRAND}</div></div></body></html>`;

const half = (side, pos) =>
  `<div class="half ${pos}"><img src="${img(side.food)}" alt=""><div class="txt"><div class="name">${side.name}</div><div class="amt">${side.amount}</div>${side.sub ? `<div class="sub">${side.sub}</div>` : ""}</div></div>`;

const slides = [
  page(
    `<img class="bg" src="${img("portada")}" alt="">
     <div class="head"><div class="l1">Así se ven</div><div class="l2">100 kcal</div><div class="l3">Mismas calorías. Muy distinto volumen.</div></div>`,
    "cover",
  ),
  ...comparisons.map((c) =>
    page(`${half(c.top, "t")}${half(c.bottom, "b")}<div class="divider"></div><div class="seam">100 kcal = 100 kcal</div>`, c.equal ? "equal" : ""),
  ),
  page(
    `<img class="bg" src="${img("resumen")}" alt="">
     <div class="head"><h2>No va de prohibir.<br>Va de <em>elegir</em>.</h2>
     <p>Llena el plato de fruta, verdura y proteína. Las grasas, sí, pero medidas.</p></div>`,
    "msg",
  ),
  page(
    `<img class="bg" src="${img("cta")}" alt="">
     <div class="head"><h2>¿Quieres comer así<br>sin <em>pasar hambre</em>?</h2>
     <div class="comment">${CHAT}<div><b>Comenta<span>PLAN</span></b><small>y te escribo por MD para empezar juntos</small></div></div></div>`,
    "msg",
  ),
];

const executablePath = ["/opt/pw-browsers/chromium", process.env.CHROMIUM_PATH].find((p) => p && existsSync(p));
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const [i, html] of slides.entries()) {
  await pg.setContent(html, { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  const file = join(out, `${String(i + 1).padStart(2, "0")}.png`);
  await pg.screenshot({ path: file });
  console.log(file);
}
await browser.close();
