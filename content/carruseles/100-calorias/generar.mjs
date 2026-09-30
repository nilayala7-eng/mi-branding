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

// Kcal aproximadas (tablas BEDCA/USDA, valores redondeados).
const comparisons = [
  { top: { food: "aceite", amount: "11 g", name: "Aceite de oliva" }, bottom: { food: "fresas", amount: "310 g", name: "Fresas" } },
  { top: { food: "almendras", amount: "14", name: "Almendras" }, bottom: { food: "manzana", amount: "1", name: "Manzana grande" } },
  { top: { food: "chocolate", amount: "17 g", name: "Chocolate 70%" }, bottom: { food: "sandia", amount: "330 g", name: "Sandía" } },
  { top: { food: "refresco", amount: "240 ml", name: "Refresco" }, bottom: { food: "palomitas", amount: "3", name: "Tazas de palomitas" } },
  {
    top: { food: "pollo", amount: "85 g", name: "Pechuga de pollo", sub: "≈ 20 g de proteína" },
    bottom: { food: "claras", amount: "6", name: "Claras de huevo", sub: "≈ 21 g de proteína" },
  },
];

const css = `
@font-face { font-family: Sora; src: url(${font("sora", "sora-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 800; }
@font-face { font-family: Inter; src: url(${font("inter", "inter-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 900; }
:root { --ink:#1B1C1E; --ink-soft:#57574F; --green-deep:#0A6E42; --bg:#FAF8F3; }
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
.name { font:600 23px/1 Inter; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-soft); }
.amt { font:700 150px/.92 Sora; letter-spacing:-.05em; margin-top:18px; }
.half.b .amt { color:var(--green-deep); }
.sub { font:500 26px/1.2 Inter; color:var(--ink-soft); margin-top:16px; }
.seam { position:absolute; left:50%; top:675px; transform:translate(-50%,-50%); background:var(--ink); color:#fff; font:700 30px/1 Sora; letter-spacing:-.01em; padding:20px 34px; border-radius:999px; box-shadow:0 10px 30px rgba(27,28,30,.18); white-space:nowrap; }
.divider { position:absolute; left:0; right:0; top:675px; height:1px; background:rgba(27,28,30,.08); }

/* Portada */
.cover .head { position:absolute; left:72px; top:92px; }
.cover .l1 { font:700 88px/1 Sora; letter-spacing:-.04em; }
.cover .l2 { font:800 236px/.86 Sora; letter-spacing:-.06em; color:var(--green-deep); margin-top:10px; }
.cover .l3 { font:400 32px/1.35 Inter; color:var(--ink-soft); margin-top:30px; }

/* Resumen y CTA */
.msg .head { position:absolute; left:72px; right:72px; top:96px; }
.msg h2 { font:700 96px/1.02 Sora; letter-spacing:-.045em; }
.msg h2 em { font-style:normal; color:var(--green-deep); }
.msg p { font:400 32px/1.45 Inter; color:var(--ink-soft); margin-top:30px; max-width:780px; }
.msg .cta { display:inline-block; margin-top:40px; background:var(--green-deep); color:#fff; font:600 30px/1 Inter; padding:26px 40px; border-radius:999px; }
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
    page(`${half(c.top, "t")}${half(c.bottom, "b")}<div class="divider"></div><div class="seam">100 kcal = 100 kcal</div>`),
  ),
  page(
    `<img class="bg" src="${img("resumen")}" alt="">
     <div class="head"><h2>No va de prohibir.<br>Va de <em>elegir</em>.</h2>
     <p>Llena el plato de fruta, verdura y proteína. Las grasas, sí, pero medidas.</p></div>`,
    "msg",
  ),
  page(
    `<img class="bg" src="${img("cta")}" alt="">
     <div class="head"><h2>Come más.<br>Sin contar <em>cada</em> caloría.</h2>
     <p>Te monto un plan de entreno y nutrición a tu ritmo.</p>
     <span class="cta">Link en mi bio</span></div>`,
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
