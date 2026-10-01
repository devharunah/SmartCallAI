import { ImageResponse } from "next/og";
import { MARK_BUBBLE, MARK_LINES } from "@/components/brand-mark";

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
          background: "#292524",
          borderRadius: 16,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d={MARK_BUBBLE} fill="#ffffff" />
          {MARK_LINES.map((d) => (
            <path key={d} d={d} stroke="#292524" strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </svg>
      </div>
    ),
    { ...size }
  );
}
