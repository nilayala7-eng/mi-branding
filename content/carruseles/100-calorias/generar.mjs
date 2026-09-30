// Genera el carrusel "Así se ven 100 calorías" (1080×1350, 4:5) en PNG.
// Uso: node content/carruseles/100-calorias/generar.mjs
// Estilo: DESIGN.md (Blanco Cálido, Carbón, Verde Vital, Coral; Sora + Inter).
import { chromium } from "playwright-core";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FOOD } from "./ilustraciones.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const out = join(here, "png");
mkdirSync(out, { recursive: true });

// Fuentes embebidas: setContent() no puede cargar file:// desde about:blank.
const font = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(join(root, "node_modules/@fontsource-variable", pkg, "files", file)).toString("base64")}`;

const HANDLE = "@ayala.fit_";

// Si existe fotos/<alimento>.(jpg|jpeg|png|webp), se usa la foto real en lugar de la ilustración.
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const art = (food) => {
  for (const ext of Object.keys(MIME)) {
    const file = join(here, "fotos", `${food}.${ext}`);
    if (existsSync(file))
      return `<img class="photo" src="data:${MIME[ext]};base64,${readFileSync(file).toString("base64")}" alt="">`;
  }
  return FOOD[food];
};
const TOTAL = 8;

// Kcal aproximadas (tablas BEDCA/USDA, valores redondeados).
const comparisons = [
  {
    kicker: "Grasas vs fruta",
    left: { food: "aceite", amount: "11 g", label: "1 cucharada de aceite de oliva" },
    right: { food: "fresas", amount: "310 g", label: "Un bol grande de fresas" },
    note: "El aceite es sano, pero muy denso. Mídelo con cuchara, no a ojo.",
  },
  {
    kicker: "Snack de media tarde",
    left: { food: "almendras", amount: "14", label: "almendras (≈17\u00a0g)" },
    right: { food: "manzana", amount: "1", label: "manzana grande (≈190\u00a0g)" },
    note: "Las dos valen. Una te sacia más si llegas con hambre.",
  },
  {
    kicker: "Algo dulce",
    left: { food: "chocolate", amount: "2", label: "onzas de chocolate 70% (≈17\u00a0g)" },
    right: { food: "sandia", amount: "330 g", label: "2 tajadas de sandía" },
    note: "El chocolate no se prohíbe. Se disfruta sabiendo cuánto es.",
  },
  {
    kicker: "Picoteo en el sofá",
    left: { food: "refresco", amount: "240 ml", label: "de refresco azucarado" },
    right: { food: "palomitas", amount: "3", label: "tazas de palomitas caseras sin aceite" },
    note: "Las calorías bebidas casi no sacian. Mejor masticarlas.",
  },
  {
    kicker: "Proteína",
    left: { food: "pollo", amount: "85 g", label: "de pechuga de pollo (≈20\u00a0g proteína)" },
    right: { food: "claras", amount: "6", label: "claras de huevo (≈21\u00a0g proteína)" },
    note: "100 kcal de proteína magra te mantienen lleno durante horas.",
  },
];

const css = `
@font-face { font-family: Sora; src: url(${font("sora", "sora-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 800; }
@font-face { font-family: Sora; src: url(${font("sora", "sora-latin-ext-wght-normal.woff2")}) format("woff2"); font-weight: 100 800; unicode-range: U+0100-024F; }
@font-face { font-family: Inter; src: url(${font("inter", "inter-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 900; }
:root {
  --bg:#FAF8F3; --surface:#FFFFFF; --border:#E7E3D9; --ink:#1B1C1E; --ink-soft:#57574F;
  --green:#12B76A; --green-deep:#0A6E42; --coral:#F2765C; --coral-deep:#B23A22;
  --green-tint:#E8F6EE; --coral-tint:#FDEDE8;
}
* { box-sizing:border-box; margin:0; padding:0; }
html,body { width:1080px; height:1350px; }
body { background:var(--bg); color:var(--ink); font-family:Inter,system-ui,sans-serif; -webkit-font-smoothing:antialiased; }
.slide { position:relative; width:1080px; height:1350px; padding:88px 80px 0; overflow:hidden; display:flex; flex-direction:column; }
.display { font-family:Sora,sans-serif; }
.kicker { display:inline-flex; align-items:center; gap:14px; font:600 26px/1 Inter; letter-spacing:.14em; text-transform:uppercase; color:var(--green-deep); }
.kicker::before { content:""; width:36px; height:4px; border-radius:2px; background:var(--green); }
.hl { position:relative; white-space:nowrap; }
.hl::after { content:""; position:absolute; left:-4px; right:-4px; bottom:6px; height:22px; background:var(--coral); opacity:.45; border-radius:6px; z-index:-1; }
.hl-g::after { background:var(--green); opacity:.35; }
.footer { position:absolute; left:80px; right:80px; bottom:56px; display:flex; justify-content:space-between; align-items:center; font:500 24px/1 Inter; color:var(--ink-soft); }
.dots { display:flex; gap:10px; }
.dots i { width:10px; height:10px; border-radius:50%; background:var(--border); }
.dots i.on { background:var(--green); width:30px; border-radius:5px; }

/* Portada */
.cover h1 { font:700 118px/1.02 Sora; letter-spacing:-.035em; margin-top:40px; position:relative; z-index:0; }
.cover h1 .num { color:var(--green-deep); }
.cover p.sub { font:400 36px/1.4 Inter; color:var(--ink-soft); margin-top:34px; max-width:820px; }
.grid { margin-top:auto; margin-bottom:130px; display:grid; grid-template-columns:repeat(3,1fr); gap:22px; }
.grid .tile { background:var(--surface); border:2px solid var(--border); border-radius:28px; height:268px; display:flex; align-items:center; justify-content:center; }
.grid .tile svg { width:210px; height:210px; }
.swipe { position:absolute; right:80px; top:96px; font:600 24px/1 Inter; color:var(--ink); background:var(--surface); border:2px solid var(--border); padding:16px 22px; border-radius:999px; }

/* Comparativa */
.cmp h2 { font:700 72px/1.08 Sora; letter-spacing:-.03em; margin-top:26px; position:relative; z-index:0; }
.pair { position:relative; display:grid; grid-template-columns:1fr 1fr; gap:28px; margin-top:54px; }
.card { border-radius:32px; padding:36px 34px 40px; display:flex; flex-direction:column; min-height:720px; }
.card.a { background:var(--surface); border:2px solid var(--border); }
.card.b { background:var(--green-tint); border:2px solid #CDEBDA; }
.card .art { height:360px; display:flex; align-items:center; justify-content:center; }
.card .art svg { width:340px; height:340px; }
.card .art img.photo { width:100%; height:100%; object-fit:cover; border-radius:22px; }
.grid .tile { overflow:hidden; }
.grid .tile img.photo { width:100%; height:100%; object-fit:cover; }
.card .amt { font:700 104px/1 Sora; letter-spacing:-.04em; margin-top:18px; }
.card.b .amt { color:var(--green-deep); }
.card .lbl { font:500 31px/1.3 Inter; color:var(--ink); margin-top:14px; }
.card .tag { align-self:flex-start; font:600 22px/1 Inter; padding:12px 18px; border-radius:999px; background:var(--coral-tint); color:var(--coral-deep); letter-spacing:.02em; }
.card.b .tag { background:#fff; color:var(--green-deep); }
.eq { position:absolute; left:50%; top:318px; transform:translate(-50%,0); width:92px; height:92px; border-radius:50%; background:var(--ink); color:#fff; display:flex; align-items:center; justify-content:center; font:700 44px/1 Sora; border:8px solid var(--bg); }
.note { margin-top:34px; display:flex; gap:18px; align-items:flex-start; font:400 30px/1.45 Inter; color:var(--ink-soft); }
.note svg { flex:none; width:40px; height:40px; margin-top:2px; }

/* Resumen */
.sum h2 { font:700 84px/1.06 Sora; letter-spacing:-.03em; margin-top:30px; position:relative; z-index:0; }
.sum ul { list-style:none; margin-top:80px; display:flex; flex-direction:column; gap:32px; }
.sum li { background:var(--surface); border:2px solid var(--border); border-radius:28px; padding:48px 40px; display:flex; gap:26px; align-items:flex-start; }
.sum li svg { flex:none; width:52px; height:52px; }
.sum li b { display:block; font:600 40px/1.2 Sora; }
.sum li span { display:block; font:400 32px/1.4 Inter; color:var(--ink-soft); margin-top:8px; }

/* CTA */
.cta { background:var(--ink); color:#fff; }
.cta .kicker { color:#7FE0AE; }
.cta h2 { font:700 92px/1.05 Sora; letter-spacing:-.03em; margin-top:34px; }
.cta h2 em { font-style:normal; color:#7FE0AE; }
.cta p { font:400 34px/1.45 Inter; color:#CFCFC8; margin-top:34px; max-width:860px; }
.cta .checks { margin-top:54px; display:flex; flex-direction:column; gap:22px; font:500 32px/1.3 Inter; }
.cta .checks div { display:flex; gap:18px; align-items:center; }
.cta .checks svg { width:40px; height:40px; flex:none; }
.cta .btn { margin-top:auto; margin-bottom:150px; align-self:flex-start; background:var(--green-deep); color:#fff; font:600 38px/1 Inter; padding:34px 48px; border-radius:20px; display:flex; gap:18px; align-items:center; }
.cta .footer { color:#9A9A92; }
.cta .dots i { background:#3A3B3E; }
.cta .dots i.on { background:#7FE0AE; }
`;

const check = (bg = "#12B76A", fg = "#1B1C1E") =>
  `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${bg}"/><path d="M12 20.5l5.5 5.5L28.5 14" fill="none" stroke="${fg}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const bulb = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#FDEDE8"/><path d="M20 10a7 7 0 0 0-4 12.7V25h8v-2.3A7 7 0 0 0 20 10zM17 28h6" fill="none" stroke="#B23A22" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const footer = (n) =>
  `<div class="footer"><span>${HANDLE}</span><div class="dots">${Array.from({ length: TOTAL }, (_, i) => `<i class="${i + 1 === n ? "on" : ""}"></i>`).join("")}</div></div>`;

const page = (body, cls = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="slide ${cls}">${body}</div></body></html>`;

const slides = [];

slides.push(
  page(
    `<span class="kicker">Nutrición sin dramas</span>
     <span class="swipe">Desliza →</span>
     <h1 class="display">Así se ven <span class="num hl hl-g">100</span><br>calorías</h1>
     <p class="sub">Mismas calorías, volumen muy distinto. Saber esto te ayuda a comer tranquilo, sin contar cada bocado.</p>
     <div class="grid">${["aceite", "fresas", "almendras", "manzana", "chocolate", "sandia"].map((f) => `<div class="tile">${art(f)}</div>`).join("")}</div>
     ${footer(1)}`,
    "cover",
  ),
);

comparisons.forEach((c, i) => {
  const card = (side, cls, tag) =>
    `<div class="card ${cls}"><span class="tag">${tag}</span><div class="art">${art(side.food)}</div><div class="amt">${side.amount}</div><div class="lbl">${side.label}</div></div>`;
  slides.push(
    page(
      `<span class="kicker">${c.kicker}</span>
       <h2>100 kcal <span class="hl">son…</span></h2>
       <div class="pair">${card(c.left, "a", "Poco volumen")}${card(c.right, "b", "Mucho volumen")}<div class="eq">=</div></div>
       <div class="note">${bulb}<span>${c.note}</span></div>
       ${footer(i + 2)}`,
      "cmp",
    ),
  );
});

slides.push(
  page(
    `<span class="kicker">Lo que te llevas</span>
     <h2>No va de prohibir.<br>Va de <span class="hl hl-g">elegir</span>.</h2>
     <ul>
       <li>${check()}<div><b>Llena el plato de volumen</b><span>Fruta y verdura: mucha cantidad, pocas calorías.</span></div></li>
       <li>${check()}<div><b>Proteína en cada comida</b><span>Es lo que más sacia. Pollo, huevo, legumbre, yogur.</span></div></li>
       <li>${check()}<div><b>Grasas sí, pero medidas</b><span>Aceite y frutos secos son sanos. Solo dales cuchara.</span></div></li>
     </ul>
     ${footer(7)}`,
    "sum",
  ),
);

slides.push(
  page(
    `<span class="kicker">¿Empezamos juntos?</span>
     <h2>Tu plan, a <em>tu ritmo</em>.</h2>
     <p>Entreno + nutrición real, sin dietas imposibles. Te monto el plan y te acompaño.</p>
     <div class="checks">
       <div>${check("#7FE0AE")}Rutinas claras para tu semana</div>
       <div>${check("#7FE0AE")}Comida sencilla, sin prohibiciones</div>
       <div>${check("#7FE0AE")}Seguimiento cercano conmigo</div>
     </div>
     <div class="btn">Link en mi bio →</div>
     ${footer(8)}`,
    "cta",
  ),
);

if (slides.length !== TOTAL) throw new Error(`Esperaba ${TOTAL} slides, hay ${slides.length}`);

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
