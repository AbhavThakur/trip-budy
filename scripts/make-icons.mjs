#!/usr/bin/env node
// Generates all app icons (no native deps): gold compass rose on midnight.
// Usage: node scripts/make-icons.mjs   → writes assets/images/*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/images');
const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

// ---- geometry -------------------------------------------------------------
const inPoly = (pts, x, y) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const shape = {
  circle: (s, x, y) => (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r ** 2,
  ring: (s, x, y) => {
    const d = (x - s.cx) ** 2 + (y - s.cy) ** 2;
    return d <= s.r2 ** 2 && d >= s.r1 ** 2;
  },
  poly: (s, x, y) => inPoly(s.pts, x, y),
};
const bbox = (s) => {
  if (s.type !== 'poly') {
    const r = s.r ?? s.r2;
    return [s.cx - r, s.cy - r, s.cx + r, s.cy + r];
  }
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

/** Compass rose in a 1024 design space centred on (512,512), scaled by k. */
function compass(k, palette) {
  const c = 512;
  const P = (dx, dy) => [c + dx * k, c + dy * k];
  const shapes = [];
  const point = (angle, len, half, lit, dark) => {
    const a = (angle * Math.PI) / 180;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const px = -uy;
    const py = ux;
    const tip = P(ux * len, uy * len);
    const l = P(px * half, py * half);
    const r = P(-px * half, -py * half);
    const o = P(0, 0);
    shapes.push({ type: 'poly', pts: [o, tip, l], color: lit });
    shapes.push({ type: 'poly', pts: [o, tip, r], color: dark });
  };
  shapes.push({ type: 'ring', cx: c, cy: c, r1: 318 * k, r2: 346 * k, color: palette.ring });
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    const len = i % 3 === 0 ? 0 : 1;
    if (!len) continue;
    shapes.push({ type: 'circle', cx: c + Math.sin(a) * 290 * k, cy: c - Math.cos(a) * 290 * k, r: 9 * k, color: palette.tick });
  }
  for (const ang of [45, 135, 225, 315]) point(ang, 190, 46, palette.minorLit, palette.minorDark);
  for (const ang of [90, 180, 270]) point(ang, 300, 74, palette.lit, palette.dark);
  point(0, 300, 74, palette.northLit, palette.northDark);
  shapes.push({ type: 'circle', cx: c, cy: c, r: 50 * k, color: palette.hub });
  shapes.push({ type: 'circle', cx: c, cy: c, r: 22 * k, color: palette.ring });
  return shapes;
}

// ---- raster ----------------------------------------------------------------
function render(size, shapes, bg) {
  const s = size / 1024;
  const px = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const c = bg ? bg(x / s, y / s) : [0, 0, 0, 0];
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = c[3];
    }
  const SS = 4;
  for (const sh of shapes) {
    const [x0, y0, x1, y1] = bbox(sh).map((v) => v * s);
    const test = shape[sh.type];
    const [r, g, b, a] = sh.color;
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(size - 1, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(size - 1, Math.ceil(x1)); x++) {
        let hit = 0;
        for (let sy = 0; sy < SS; sy++)
          for (let sx = 0; sx < SS; sx++) if (test(sh, (x + (sx + 0.5) / SS) / s, (y + (sy + 0.5) / SS) / s)) hit++;
        if (!hit) continue;
        const cov = (hit / (SS * SS)) * a;
        const i = (y * size + x) * 4;
        const da = px[i + 3];
        const oa = cov + da * (1 - cov);
        for (let k = 0; k < 3; k++) px[i + k] = oa ? ([r, g, b][k] * cov + px[i + k] * da * (1 - cov)) / oa : 0;
        px[i + 3] = oa;
      }
  }
  return png(size, px);
}

// ---- PNG encoder -------------------------------------------------------------
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++)
      for (let k = 0; k < 4; k++) {
        const v = k === 3 ? px[(y * size + x) * 4 + 3] * 255 : px[(y * size + x) * 4 + k];
        raw[y * (size * 4 + 1) + 1 + x * 4 + k] = Math.max(0, Math.min(255, Math.round(v)));
      }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- assets ------------------------------------------------------------------
const gold = {
  ring: hex('#F59E0B'),
  tick: hex('#F59E0B', 0.55),
  lit: hex('#FBBF24'),
  dark: hex('#B45309'),
  northLit: hex('#F8FAFC'),
  northDark: hex('#94A3B8'),
  minorLit: hex('#FDE68A', 0.9),
  minorDark: hex('#D97706', 0.9),
  hub: hex('#080C14'),
};
const white = Object.fromEntries(Object.keys(gold).map((k) => [k, k === 'hub' ? [0, 0, 0, 0] : [255, 255, 255, k === 'tick' ? 0.6 : 1]]));

const radial = (inner, outer) => (x, y) => {
  const t = Math.min(1, Math.hypot(x - 512, y - 440) / 720);
  return [0, 1, 2].map((k) => inner[k] + (outer[k] - inner[k]) * t).concat(1);
};
const midnight = radial(hex('#1E293B'), hex('#080C14'));
const amber = radial(hex('#D97706'), hex('#78350F'));

const jobs = [
  ['icon.png', 1024, compass(0.92, gold), midnight],
  ['android-icon-foreground.png', 1024, compass(0.86 * 0.72, gold), null],
  ['android-icon-background.png', 1024, [], midnight],
  ['android-icon-background-test.png', 1024, [], amber],
  ['android-icon-monochrome.png', 1024, compass(0.86 * 0.72, { ...white, hub: [0, 0, 0, 0] }), null],
  ['splash-icon.png', 512, compass(0.95, gold), null],
  ['favicon.png', 64, compass(0.95, gold), midnight],
];
for (const [name, size, shapes, bg] of jobs) {
  fs.writeFileSync(path.join(out, name), render(size, shapes, bg));
  console.log('✔', name, `${size}px`);
}
