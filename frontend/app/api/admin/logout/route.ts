import { NextRequest, NextResponse } from "next/server";

import { adminCookieOptions, sameOrigin } from "@/lib/analytics/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signs the admin out of this browser: the cookie is cleared. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request.headers)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ ...adminCookieOptions(0), value: "" });
  return response;
}
