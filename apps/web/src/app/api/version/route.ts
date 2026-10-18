import { NextResponse } from "next/server";
import { getBuildId } from "@/lib/buildId";

export const dynamic = "force-dynamic";

/** Public, no auth, nothing sensitive: lets an open page ask "is there a newer deploy than mine?". */
export function GET() {
  return NextResponse.json({ id: getBuildId() }, { headers: { "Cache-Control": "no-store" } });
}
