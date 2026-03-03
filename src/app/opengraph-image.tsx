import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LoL Tracker - Sprawdź kto gra w League of Legends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #010a13 0%, #0a1628 40%, #0d2137 70%, #0a1628 100%)",
          position: "relative",
        }}
      >
        {/* Top gold border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background:
              "linear-gradient(90deg, transparent, #c8aa6e, #f0e6d3, #c8aa6e, transparent)",
          }}
        />
        {/* Bottom gold border */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background:
              "linear-gradient(90deg, transparent, #c8aa6e, #f0e6d3, #c8aa6e, transparent)",
          }}
        />

        {/* Decorative diamond */}
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "2px solid #c8aa6e",
            transform: "rotate(45deg)",
            marginBottom: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              background: "#c8aa6e",
              transform: "rotate(0deg)",
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#c8aa6e",
            textTransform: "uppercase" as const,
            display: "flex",
          }}
        >
          LoL Tracker
        </div>

        {/* Divider */}
        <div
          style={{
            width: "200px",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, #c8aa6e, transparent)",
            margin: "24px 0",
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: "24px",
            color: "#a09b8c",
            letterSpacing: "0.2em",
            textTransform: "uppercase" as const,
            display: "flex",
          }}
        >
          Live tracker znajomych
        </div>

        {/* Features row */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: "48px",
            color: "#5b5a56",
            fontSize: "16px",
            letterSpacing: "0.15em",
            textTransform: "uppercase" as const,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#0ac8b9",
                display: "flex",
              }}
            />
            <span>Live game</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#c89b3c",
                display: "flex",
              }}
            />
            <span>Rangi</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#1db954",
                display: "flex",
              }}
            />
            <span>Mecze</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
