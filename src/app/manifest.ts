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
  };
}
