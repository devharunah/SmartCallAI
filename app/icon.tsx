import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M6.6 10.8c1.2 2.4 3.2 4.4 5.6 5.6l1.9-1.9a1 1 0 0 1 1-.25 8 8 0 0 0 2.5.4 1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A15 15 0 0 1 3 6a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1 8 8 0 0 0 .4 2.5 1 1 0 0 1-.25 1z"
            fill="#00d4a4"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
