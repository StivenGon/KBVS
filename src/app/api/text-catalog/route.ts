import { NextResponse } from "next/server";

import { loadTextCatalog } from "@/lib/text-catalog-service";

export async function GET() {
  const texts = await loadTextCatalog({ forceRefresh: true });

  return NextResponse.json({ texts });
}
