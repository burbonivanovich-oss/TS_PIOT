import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { createOgTemplate } from "./templates.js";
import type { TemplateData } from "./types.js";
import path from "path";
import fs from "fs/promises";

// Satori requires font data — we use a system font embedded as base64 or load from file
async function getFontData(): Promise<ArrayBuffer> {
  // Try common system font paths
  const candidates = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
  ];
  for (const p of candidates) {
    try {
      const data = await fs.readFile(p);
      return data.buffer as ArrayBuffer;
    } catch {
      // try next
    }
  }
  throw new Error(
    "No system font found. Install fonts or provide a font file."
  );
}

export async function renderTemplate(
  data: TemplateData,
  outputDir: string
): Promise<string> {
  const fontData = await getFontData();
  const element = createOgTemplate(data);

  const svg = await satori(element, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "sans-serif",
        data: fontData,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  const png = resvg.render().asPng();

  const slug = `${data.background.model.replace(/[^a-z0-9]/gi, "-")}_${data.background.style}`;
  const svgPath = path.join(outputDir, `${slug}.svg`);
  const pngPath = path.join(outputDir, `${slug}.png`);

  await fs.writeFile(svgPath, svg);
  await fs.writeFile(pngPath, png);

  return pngPath;
}
