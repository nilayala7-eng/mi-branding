// Ilustraciones planas propias (SVG, viewBox 200×200) para el carrusel de 100 kcal.
const svg = (inner) => `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const shadow = (cx = 100, cy = 178, rx = 70) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="9" fill="#1B1C1E" opacity=".07"/>`;

const strawberry = (x, y, s = 1, r = 0) => `
  <g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">
    <path d="M0 26C-14 20-20 6-18-4c2-8 10-10 18-8 8-2 16 0 18 8 2 10-4 24-18 30z" fill="#E5484D"/>
    <path d="M-10-2c-2 6 0 14 4 20" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${[[-8, 2], [0, 6], [8, 2], [-4, 12], [5, 13], [0, 20], [-10, -4], [10, -4]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="1.2" ry="1.8" fill="#FFD66B"/>`).join("")}
    <path d="M0-12l-9-6 6 8-10 0 10 4-4 6 7-5 7 5-4-6 10-4-10 0 6-8z" fill="#2E9E5B"/>
  </g>`;

const almond = (x, y, r) => `
  <g transform="translate(${x} ${y}) rotate(${r})">
    <path d="M0-16C10-10 12 6 0 16-12 6-10-10 0-16z" fill="#B97A4B"/>
    <path d="M0-12c4 6 4 16 0 24" stroke="#8C5A33" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/>
    <path d="M-4-8c-3 5-3 11 0 16" stroke="#E0A878" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>`;

const popcorn = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="-6" cy="0" r="8" fill="#FFF6DD"/><circle cx="5" cy="-4" r="8" fill="#FFFBEF"/><circle cx="3" cy="6" r="7" fill="#FFF3D1"/>
    <circle cx="-2" cy="2" r="3" fill="#F5C45E"/>
  </g>`;

const egg = (x, y) => `
  <g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="0" rx="17" ry="21" fill="#FFFFFF" stroke="#E7E3D9" stroke-width="2.5"/>
    <ellipse cx="-6" cy="-8" rx="4" ry="6" fill="#F3EFE6"/>
  </g>`;

export const FOOD = {
  aceite: svg(`
    ${shadow(100, 176, 76)}
    <g transform="rotate(-18 100 110)">
      <rect x="112" y="102" width="82" height="14" rx="7" fill="#C9C4B8"/>
      <ellipse cx="72" cy="109" rx="52" ry="30" fill="#DAD6CC"/>
      <ellipse cx="72" cy="105" rx="44" ry="22" fill="#E9B83F"/>
      <ellipse cx="60" cy="99" rx="16" ry="6" fill="#F7DB85"/>
    </g>
    <path d="M70 26c10 14 16 24 16 32a16 16 0 0 1-32 0c0-8 6-18 16-32z" fill="#E9B83F"/>
    <path d="M64 56a6 6 0 0 0 6 6" stroke="#F7DB85" stroke-width="3.5" fill="none" stroke-linecap="round"/>`),

  fresas: svg(`
    ${shadow(100, 180, 80)}
    ${strawberry(62, 78, 1.05, -20)}${strawberry(100, 66, 1.1, 4)}${strawberry(138, 80, 1.05, 22)}
    ${strawberry(80, 96, 1, -8)}${strawberry(120, 96, 1, 12)}
    <path d="M22 110h156c-4 38-34 62-78 62s-74-24-78-62z" fill="#FFFFFF" stroke="#E7E3D9" stroke-width="3"/>
    <path d="M22 110h156" stroke="#12B76A" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 126c10 20 30 32 60 34" stroke="#E8F6EE" stroke-width="6" fill="none" stroke-linecap="round"/>`),

  almendras: svg(`
    ${shadow(100, 176, 72)}
    ${[
      [52, 150, -30], [82, 156, 10], [112, 154, -12], [142, 150, 30], [66, 128, 20],
      [96, 132, -40], [126, 128, 14], [154, 124, -20], [50, 104, -8], [80, 106, 36],
      [110, 104, -20], [140, 100, 8], [94, 80, 18], [124, 78, -30],
    ].map(([x, y, r]) => almond(x, y, r)).join("")}`),

  manzana: svg(`
    ${shadow(100, 180, 62)}
    <path d="M100 58c-18-14-60-12-66 30-6 44 26 86 50 86 8 0 12-4 16-4s8 4 16 4c24 0 56-42 50-86-6-42-48-44-66-30z" fill="#E5484D"/>
    <path d="M52 92c-2 20 6 40 18 52" stroke="#fff" stroke-opacity=".3" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M100 60c0-14 4-26 12-34" stroke="#6B4A2E" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M106 42c14-14 34-14 40-6-8 12-28 16-40 6z" fill="#2E9E5B"/>`),

  chocolate: svg(`
    ${shadow(100, 178, 74)}
    <g transform="rotate(-10 100 110)">
      <rect x="36" y="72" width="64" height="64" rx="8" fill="#5B3A29"/>
      <rect x="44" y="80" width="48" height="48" rx="5" fill="#6E4633"/>
      <path d="M44 80l8 8h32l8-8M44 128l8-8h32l8 8" fill="none" stroke="#4A2F21" stroke-width="2"/>
    </g>
    <g transform="rotate(12 130 120)">
      <rect x="100" y="90" width="64" height="64" rx="8" fill="#5B3A29"/>
      <rect x="108" y="98" width="48" height="48" rx="5" fill="#6E4633"/>
      <path d="M108 98l8 8h32l8-8M108 146l8-8h32l8 8" fill="none" stroke="#4A2F21" stroke-width="2"/>
    </g>`),

  sandia: svg(`
    ${shadow(100, 180, 80)}
    <g transform="translate(58 104) rotate(-14)">
      <path d="M-44-8a44 44 0 0 0 88 0z" fill="#2E9E5B"/>
      <path d="M-38-8a38 38 0 0 0 76 0z" fill="#DDF5C8"/>
      <path d="M-34-8a34 34 0 0 0 68 0z" fill="#F25C6B"/>
      ${[[-16, 2], [0, 10], [16, 2], [-6, 18], [8, 18]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="3.6" fill="#1B1C1E"/>`).join("")}
    </g>
    <g transform="translate(138 118) rotate(12)">
      <path d="M-44-8a44 44 0 0 0 88 0z" fill="#2E9E5B"/>
      <path d="M-38-8a38 38 0 0 0 76 0z" fill="#DDF5C8"/>
      <path d="M-34-8a34 34 0 0 0 68 0z" fill="#F25C6B"/>
      ${[[-16, 2], [0, 10], [16, 2], [-6, 18], [8, 18]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="3.6" fill="#1B1C1E"/>`).join("")}
    </g>`),

  refresco: svg(`
    ${shadow(100, 182, 52)}
    <path d="M58 40h84l-10 136H68z" fill="#FFFFFF" stroke="#E7E3D9" stroke-width="3"/>
    <path d="M62 70h76l-8 100H70z" fill="#3B2218"/>
    <path d="M62 70h76" stroke="#8A5A3C" stroke-width="5"/>
    ${[[80, 100, 3], [96, 128, 2.5], [112, 94, 2], [118, 140, 3], [86, 154, 2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".35"/>`).join("")}
    <rect x="112" y="18" width="7" height="92" rx="3.5" transform="rotate(14 115 64)" fill="#F2765C"/>
    <rect x="72" y="84" width="22" height="22" rx="4" fill="#fff" opacity=".3" transform="rotate(-12 83 95)"/>`),

  palomitas: svg(`
    ${shadow(100, 182, 70)}
    ${[[62, 70], [84, 56], [108, 52], [132, 62], [146, 80], [52, 88], [74, 80], [98, 72], [122, 80], [80, 96], [110, 96], [138, 98], [60, 104]].map(([x, y]) => popcorn(x, y, 1.15)).join("")}
    <path d="M44 100h112l-14 78H58z" fill="#FFFFFF" stroke="#E7E3D9" stroke-width="3"/>
    ${[62, 82, 100, 118, 138].map((x) => `<path d="M${x} 100l${(x - 100) * -0.12} 78" stroke="#F2765C" stroke-width="9"/>`).join("")}
    <path d="M44 100h112" stroke="#E7E3D9" stroke-width="3"/>`),

  pollo: svg(`
    ${shadow(100, 170, 80)}
    <ellipse cx="100" cy="132" rx="84" ry="34" fill="#FFFFFF" stroke="#E7E3D9" stroke-width="3"/>
    <path d="M40 124c0-26 30-48 64-48 30 0 56 14 56 34 0 24-30 36-62 36-34 0-58-6-58-22z" fill="#E9B27A"/>
    <path d="M44 122c4 12 26 18 54 18 26 0 50-6 58-18" stroke="#D08F52" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${[70, 92, 114, 136].map((x) => `<path d="M${x - 10} ${96 + (x - 70) * 0.05}l20 34" stroke="#9C5E2E" stroke-width="5" stroke-linecap="round" opacity=".75"/>`).join("")}
    <path d="M150 90c6-4 14-4 18 2" stroke="#2E9E5B" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="160" cy="96" r="5" fill="#2E9E5B"/>`),

  claras: svg(`
    ${shadow(100, 176, 80)}
    ${[[80, 94], [120, 94], [60, 142], [100, 142], [140, 142], [100, 50]].map(([x, y]) => egg(x, y)).join("")}`),
};
