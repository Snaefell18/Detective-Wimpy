#!/usr/bin/env node
/**
 * Erzeugt die App-Icons (Platzhalter: Lupe auf dunklem Grund) in /public/icons.
 * Einfach durch eigene PNGs gleichen Namens ersetzen, wenn es hübscher sein soll.
 * Aufruf: node scripts/make-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "icons");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, paint) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(size * 4 + 1);
    row[0] = 0; // Filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y, size);
      row.set([r, g, b, a], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Dunkler Grund, goldener Lupenring mit Griff. */
const lupe = (x, y, size) => {
  const s = size / 512;
  const cx = 220 * s;
  const cy = 210 * s;
  const r = 130 * s;
  const dicke = 34 * s;
  const d = Math.hypot(x - cx, y - cy);

  const gold = [255, 196, 77, 255];
  const grund = [16, 13, 26, 255];

  if (Math.abs(d - r) < dicke / 2) return gold;
  if (d < r - dicke / 2) return [36, 29, 58, 255];

  // Griff: dickes Segment von unten rechts weg vom Ring
  const gx = x - cx;
  const gy = y - cy;
  const auf = (gx + gy) / Math.SQRT2; // Projektion auf die 45°-Achse
  const quer = (gy - gx) / Math.SQRT2;
  if (auf > r - 6 * s && auf < r + 150 * s && Math.abs(quer) < dicke / 2) return gold;

  return grund;
};

fs.mkdirSync(outDir, { recursive: true });
for (const size of [180, 192, 512]) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, png(size, lupe));
  console.log(`geschrieben: public/icons/icon-${size}.png`);
}
