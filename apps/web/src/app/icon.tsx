import { ImageResponse } from "next/og";

// Gerado em código, sem arquivo de imagem: mesmo desenho do <Logo markOnly />
// (quadrado arredondado, verde-700, "E" branca em negrito), mas em JSX à
// parte — o ImageResponse roda em Satori, que não entende classe Tailwind
// nem var(--cor), só style inline com valor literal.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#027A48",
        borderRadius: 7,
        color: "#ffffff",
        fontSize: 22,
        fontWeight: 700,
      }}
    >
      E
    </div>,
    { ...size },
  );
}
