import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Generates the app icons from code instead of committing binaries nobody can
 * review. Everything the app ships is either source or derived from source —
 * no asset is fetched from a CDN at build or at runtime.
 *
 * The mark is a ring: kirai-zero, zero unwanted gifts.
 */

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../public");

const ACCENT = [180, 83, 31];
const PAPER = [253, 251, 247];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 3;
      raw[offset] = pixels[index];
      raw[offset + 1] = pixels[index + 1];
      raw[offset + 2] = pixels[index + 2];
      offset += 3;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Coverage of the ring at one pixel, sampled 3x3 to get smooth edges. */
function ringCoverage(x, y, size) {
  const centre = size / 2;
  // Sized to survive the maskable safe zone, which crops to the inner 80%.
  const outer = size * 0.3;
  const inner = size * 0.19;
  let hits = 0;
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      const dx = x + (sx + 0.5) / 3 - centre;
      const dy = y + (sy + 0.5) / 3 - centre;
      const distance = Math.hypot(dx, dy);
      if (distance <= outer && distance >= inner) hits += 1;
    }
  }
  return hits / 9;
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = ringCoverage(x, y, size);
      const index = (y * size + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[index + channel] = Math.round(
          ACCENT[channel] * (1 - coverage) + PAPER[channel] * coverage,
        );
      }
    }
  }
  return encodePng(size, pixels);
}

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#b4531f"/>
  <circle cx="32" cy="32" r="15.7" fill="none" stroke="#fdfbf7" stroke-width="7"/>
</svg>
`;

mkdirSync(PUBLIC_DIR, { recursive: true });
writeFileSync(join(PUBLIC_DIR, "icon-192.png"), renderIcon(192));
writeFileSync(join(PUBLIC_DIR, "icon-512.png"), renderIcon(512));
writeFileSync(join(PUBLIC_DIR, "apple-touch-icon.png"), renderIcon(180));
writeFileSync(join(PUBLIC_DIR, "favicon.svg"), FAVICON_SVG);
console.log("Icons written to apps/web/public");
