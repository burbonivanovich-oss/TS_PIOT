export type BackgroundStyle =
  | "geometric"
  | "gradient"
  | "abstract"
  | "nature"
  | "cyberpunk"
  | "minimal"
  | "retro";

export interface GeneratedBackground {
  style: BackgroundStyle;
  model: string;
  svgContent: string;
  prompt: string;
}

export interface TemplateData {
  title: string;
  subtitle?: string;
  background: GeneratedBackground;
}

export interface ModelConfig {
  name: string;
  displayName: string;
}

export const GEMINI_MODELS: ModelConfig[] = [
  { name: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
  { name: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash" },
  { name: "gemini-1.5-pro", displayName: "Gemini 1.5 Pro" },
];

export const BACKGROUND_STYLES: BackgroundStyle[] = [
  "geometric",
  "gradient",
  "abstract",
  "cyberpunk",
  "minimal",
  "retro",
];
