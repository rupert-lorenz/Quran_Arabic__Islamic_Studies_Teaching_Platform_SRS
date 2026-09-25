import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const FONT_CANDIDATES = [
  "C:\\Windows\\Fonts\\arialbd.ttf",
  "C:\\Windows\\Fonts\\arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/Library/Fonts/Arial Bold.ttf",
  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
];

let cached: ArrayBuffer | undefined;

export async function loadOgFont() {
  if (cached) {
    return cached;
  }
  const path = FONT_CANDIDATES.find((file) => existsSync(file));
  if (!path) {
    throw new Error(
      "Open Graph images need a static TTF. Install Arial (Windows) or DejaVu Sans (Linux).",
    );
  }
  const file = await readFile(path);
  cached = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  return cached;
}

export function ogFontOptions(data: ArrayBuffer) {
  return [
    {
      name: "OG Sans",
      data,
      style: "normal" as const,
      weight: 700 as const,
    },
  ];
}
