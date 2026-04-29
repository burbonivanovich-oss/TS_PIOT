import { GoogleGenAI } from "@google/genai";
import type { BackgroundStyle, GeneratedBackground, ModelConfig } from "./types.js";

const STYLE_PROMPTS: Record<BackgroundStyle, string> = {
  geometric: `Create a pure SVG background (1200x630px) with a geometric pattern.
Use bold shapes: triangles, hexagons, circles arranged in a repeating pattern.
Colors: deep blues and purples (#0f0c29, #302b63, #24243e) with bright accent (#6c63ff).
The SVG must be self-contained, no external dependencies, no JavaScript.
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,

  gradient: `Create a pure SVG background (1200x630px) with a stunning multi-color gradient.
Use <defs> with <linearGradient> or <radialGradient> elements.
Colors: warm sunset palette (coral, orange, magenta, deep purple).
Add subtle noise/grain texture using <feTurbulence> filter.
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,

  abstract: `Create a pure SVG background (1200x630px) with flowing abstract shapes.
Use organic bezier curves (<path> with C commands), overlapping semi-transparent blobs.
Colors: teal, mint, seafoam (#00b4d8, #90e0ef, #caf0f8) on dark navy background.
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,

  nature: `Create a pure SVG background (1200x630px) inspired by northern lights (aurora).
Use flowing horizontal bands of color with varying opacity.
Colors: deep dark sky (#0d0221), greens (#39ff14, #00ff7f), blues (#00bfff) and purples.
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,

  cyberpunk: `Create a pure SVG background (1200x630px) with a cyberpunk/neon grid aesthetic.
Use a dark background (#0a0a0a) with glowing neon grid lines (perspective grid),
scattered glitch artifacts, and neon color accents (#ff00ff, #00ffff, #ff0066).
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,

  minimal: `Create a pure SVG background (1200x630px) with an elegant minimal design.
Use a clean off-white or light gray background with very subtle geometric lines or dots.
One or two thin accent lines or circles. Color palette: #f8f9fa, #e9ecef, #adb5bd, #495057.
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,

  retro: `Create a pure SVG background (1200x630px) with a retro 80s synthwave aesthetic.
Dark purple/navy sky (#1a0030), horizontal scanlines at bottom, sun with gradient stripes,
grid floor in perspective. Colors: purple, pink, orange (#ff6ec7, #ff9f43, #a55eea).
Output ONLY the SVG code starting with <svg and ending with </svg>. No explanation.`,
};

function extractSvg(text: string): string {
  const match = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (match) return match[0];
  if (text.trim().startsWith("<svg")) return text.trim();
  throw new Error("No valid SVG found in Gemini response");
}

export async function generateBackground(
  apiKey: string,
  model: ModelConfig,
  style: BackgroundStyle
): Promise<GeneratedBackground> {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = STYLE_PROMPTS[style];

  console.log(`  [${model.displayName}] Generating "${style}" background...`);

  let response;
  try {
    response = await ai.models.generateContent({
      model: model.name,
      contents: prompt,
    });
  } catch (err) {
    // Parse Gemini API errors for a cleaner message
    const raw = err instanceof Error ? err.message : String(err);
    let parsed: { error?: { message?: string; status?: string } } | undefined;
    try { parsed = JSON.parse(raw); } catch {}
    const msg = parsed?.error?.message ?? raw;
    throw new Error(`Gemini API error (${model.name}): ${msg}`);
  }

  const text = response.text ?? "";
  const svgContent = extractSvg(text);

  return {
    style,
    model: model.name,
    svgContent,
    prompt,
  };
}
