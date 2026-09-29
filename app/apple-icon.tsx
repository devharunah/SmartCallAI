import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <svg width="104" height="104" viewBox="0 0 24 24" fill="none">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="#00d4a4" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
