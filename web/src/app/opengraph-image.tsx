import { ImageResponse } from "next/og";
import { defaultBrand } from "@/lib/brand";
import { getBrand } from "@/server/brand";
import { loadOgFont, ogFontOptions } from "@/server/og-font";

export const alt = "Al Haramain Schools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function OpenGraphImage() {
  const [brand, font] = await Promise.all([
    getBrand().catch(() => defaultBrand),
    loadOgFont(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: brand.colors?.primary ?? "#294634",
          color: "#ffffff",
          fontFamily: "OG Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            color: brand.colors?.accent ?? "#CB9F64",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {brand.tagline}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {brand.name}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: ogFontOptions(font),
    },
  );
}
