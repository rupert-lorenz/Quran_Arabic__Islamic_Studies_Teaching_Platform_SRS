import { ImageResponse } from "next/og";
import { loadOgFont, ogFontOptions } from "@/server/og-font";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function AppleIcon() {
  const font = await loadOgFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#294634",
          borderRadius: 40,
          fontFamily: "OG Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#CB9F64",
            fontSize: 72,
            fontWeight: 700,
          }}
        >
          AH
        </div>
      </div>
    ),
    {
      ...size,
      fonts: ogFontOptions(font),
    },
  );
}
