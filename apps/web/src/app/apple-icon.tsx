import { ImageResponse } from "next/og";

// iOS não usa SVG para ícone de tela de início — só aceita jpg/jpeg/png.
// Mesmo desenho do favicon (app/icon.tsx), em 180×180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#027A48",
        color: "#ffffff",
        fontSize: 120,
        fontWeight: 700,
      }}
    >
      E
    </div>,
    { ...size },
  );
}
