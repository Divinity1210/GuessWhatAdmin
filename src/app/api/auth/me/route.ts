import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";

export async function GET() {
  const user = await getAuthenticatedAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
