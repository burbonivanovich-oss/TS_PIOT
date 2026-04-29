import React from "react";
import type { TemplateData } from "./types.js";

// Satori-compatible React element tree (no Tailwind, only inline styles)
export function createOgTemplate(data: TemplateData): React.ReactElement {
  const { title, subtitle, background } = data;

  // Embed the SVG as a data URI for use as a background image
  const svgBase64 = Buffer.from(background.svgContent).toString("base64");
  const bgUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return React.createElement(
    "div",
    {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        backgroundImage: `url("${bgUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "60px",
        fontFamily: "sans-serif",
        position: "relative",
      },
    },
    // Gradient overlay for text readability
    React.createElement("div", {
      style: {
        position: "absolute",
        inset: "0",
        background:
          "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",
      },
    }),
    // Badge: model name
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: "40px",
          right: "40px",
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "20px",
          padding: "8px 18px",
          color: "#fff",
          fontSize: "14px",
          fontWeight: "600",
          letterSpacing: "0.05em",
        },
      },
      background.model
    ),
    // Style chip
    React.createElement(
      "div",
      {
        style: {
          position: "absolute",
          top: "40px",
          left: "40px",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: "20px",
          padding: "8px 18px",
          color: "rgba(255,255,255,0.8)",
          fontSize: "14px",
          fontWeight: "500",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        },
      },
      background.style
    ),
    // Text content
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        },
      },
      React.createElement(
        "h1",
        {
          style: {
            margin: "0",
            fontSize: "64px",
            fontWeight: "800",
            color: "#ffffff",
            lineHeight: "1.1",
            letterSpacing: "-0.02em",
            textShadow: "0 2px 20px rgba(0,0,0,0.5)",
          },
        },
        title
      ),
      subtitle
        ? React.createElement(
            "p",
            {
              style: {
                margin: "0",
                fontSize: "24px",
                fontWeight: "400",
                color: "rgba(255,255,255,0.75)",
                lineHeight: "1.4",
              },
            },
            subtitle
          )
        : null
    )
  );
}
