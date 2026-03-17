import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("sal_session", "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
