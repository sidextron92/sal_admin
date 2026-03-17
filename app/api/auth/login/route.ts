import { NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@maeri.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "maeri2026";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const response = NextResponse.json({ success: true });
    response.cookies.set("sal_session", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return response;
  }

  return NextResponse.json(
    { success: false, error: "Invalid email or password" },
    { status: 401 }
  );
}
