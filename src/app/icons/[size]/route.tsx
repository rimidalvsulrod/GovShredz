import { ImageResponse } from "next/og";

// App icons for the home screen (PNG), drawn on demand.
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = Math.min(1024, Math.max(32, Number((await ctx.params).size) || 192));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#060608" }}>
        <div
          style={{
            width: "78%",
            height: "78%",
            borderRadius: "24%",
            background: "#c8ff2e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.36,
            fontWeight: 900,
            fontStyle: "italic",
            color: "#060608",
            letterSpacing: -2,
          }}
        >
          GS
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
