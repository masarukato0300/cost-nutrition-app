import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "パティスリー経営ナビ",
    short_name: "経営ナビ",
    description:
      "原価・売上・粗利・商圏から、次の一手が見える。小さな洋菓子店のためのAI経営判断アプリ。",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#0f766e",
    lang: "ja",
    icons: [
      {
        src: "/icons/patisserie-keiei-navi-128.png",
        sizes: "128x128",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/patisserie-keiei-navi-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/patisserie-keiei-navi-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
