import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets", "logo", "app", "app-icon.svg");
const outDir = path.join(root, "build");

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

function render(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0, 0, 0, 0)",
  });
  return resvg.render().asPng();
}

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(images.length * 16);
  let offset = 6 + images.length * 16;

  images.forEach(({ size, data }, index) => {
    const base = index * 16;
    const dimension = size >= 256 ? 0 : size;
    entries.writeUInt8(dimension, base);
    entries.writeUInt8(dimension, base + 1);
    entries.writeUInt8(0, base + 2);
    entries.writeUInt8(0, base + 3);
    entries.writeUInt16LE(1, base + 4);
    entries.writeUInt16LE(32, base + 6);
    entries.writeUInt32LE(data.length, base + 8);
    entries.writeUInt32LE(offset, base + 12);
    offset += data.length;
  });

  return Buffer.concat([header, entries, ...images.map((image) => image.data)]);
}

const svg = readFileSync(source, "utf8");
mkdirSync(outDir, { recursive: true });

const images = ICO_SIZES.map((size) => ({ size, data: render(svg, size) }));
writeFileSync(path.join(outDir, "icon.ico"), ico(images));
writeFileSync(path.join(outDir, "icon.png"), render(svg, 512));

console.log(`icon.ico (${ICO_SIZES.join(", ")}) and icon.png (512) written to build/`);
