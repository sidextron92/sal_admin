"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function RoseMotif() {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      width="360"
      height="360"
      viewBox="0 0 360 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {angles.map((angle) => (
        <ellipse
          key={`fill-${angle}`}
          cx="180"
          cy="88"
          rx="30"
          ry="94"
          fill="#d57282"
          opacity="0.055"
          transform={`rotate(${angle} 180 180)`}
        />
      ))}
      {angles.map((angle) => (
        <ellipse
          key={`stroke-${angle}`}
          cx="180"
          cy="95"
          rx="24"
          ry="87"
          fill="none"
          stroke="#d57282"
          strokeWidth="0.75"
          opacity="0.13"
          transform={`rotate(${angle} 180 180)`}
        />
      ))}
      <circle cx="180" cy="180" r="24" fill="#d57282" opacity="0.07" />
      <circle cx="180" cy="180" r="120" stroke="#d57282" strokeWidth="0.5" opacity="0.1" fill="none" />
      <circle cx="180" cy="180" r="80" stroke="#d57282" strokeWidth="0.5" opacity="0.1" fill="none" />
      <circle cx="180" cy="180" r="44" stroke="#d57282" strokeWidth="0.5" opacity="0.08" fill="none" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/dashboard/overview");
      } else {
        setError(data.error ?? "Login failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (desktop only) ── */}
      <div
        className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden shrink-0"
        style={{
          width: "42%",
          background: "linear-gradient(155deg, #fdf5f7 0%, #fce8ec 55%, #f8dce4 100%)",
        }}
      >
        {/* Decorative rose motif */}
        <div className="absolute inset-0 flex items-center justify-center">
          <RoseMotif />
        </div>

        {/* Brand content */}
        <div className="relative z-10 text-center select-none px-12">
          <h1
            style={{
              fontFamily: "var(--font-poppins), sans-serif",
              fontWeight: 300,
              fontSize: "4rem",
              letterSpacing: "0.25em",
              color: "#d57282",
              lineHeight: 1,
            }}
          >
            maeri
          </h1>

          {/* Decorative divider */}
          <div
            style={{
              width: 48,
              height: 1,
              backgroundColor: "#d57282",
              margin: "20px auto",
              opacity: 0.45,
            }}
          />

          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#b8838e",
              fontWeight: 500,
            }}
          >
            Control Centre
          </p>

          <p
            style={{
              marginTop: 36,
              fontSize: "0.875rem",
              color: "#b8838e",
              lineHeight: 1.9,
              fontWeight: 400,
            }}
          >
            Crafted with love.
            <br />
            Managed with care.
          </p>
        </div>

        {/* Bottom brand URL */}
        <p
          className="absolute bottom-8"
          style={{
            fontSize: "0.6rem",
            color: "#c9a3aa",
            letterSpacing: "0.1em",
            fontWeight: 400,
          }}
        >
          maeri.in
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div
        className="flex flex-col flex-1 items-center justify-center px-6 py-12"
        style={{ backgroundColor: "#fffbf6" }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-10">
          <h1
            style={{
              fontFamily: "var(--font-poppins), sans-serif",
              fontWeight: 300,
              fontSize: "2.75rem",
              letterSpacing: "0.22em",
              color: "#d57282",
              lineHeight: 1,
            }}
          >
            maeri
          </h1>
          <p
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#8a8a8a",
              fontWeight: 500,
              marginTop: 8,
            }}
          >
            Control Centre
          </p>
        </div>

        {/* Form card */}
        <div
          className="w-full max-w-sm bg-white rounded-2xl p-8"
          style={{
            border: "1px solid #E2E2E2",
            boxShadow: "0 4px 24px rgba(213, 114, 130, 0.1)",
          }}
        >
          <div className="mb-7">
            <h2 className="text-xl font-semibold" style={{ color: "#525252" }}>
              Welcome back
            </h2>
            <p className="text-sm mt-1" style={{ color: "#8a8a8a" }}>
              Sign in to manage your operations
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-[0.65rem] font-medium mb-2 tracking-widest uppercase"
                style={{ color: "#8a8a8a" }}
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@maeri.in"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200"
                style={{
                  borderColor: "#E2E2E2",
                  color: "#525252",
                  backgroundColor: "#fafafa",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#d57282";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(213, 114, 130, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E2E2";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div>
              <label
                className="block text-[0.65rem] font-medium mb-2 tracking-widest uppercase"
                style={{ color: "#8a8a8a" }}
                htmlFor="password"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200"
                style={{
                  borderColor: "#E2E2E2",
                  color: "#525252",
                  backgroundColor: "#fafafa",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#d57282";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(213, 114, 130, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E2E2";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <p
                className="text-sm rounded-xl px-4 py-2.5"
                style={{ color: "#ef4444", backgroundColor: "#fef2f2" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white transition-all duration-200 mt-2 disabled:opacity-60"
              style={{
                backgroundColor: loading ? "#e8a0a8" : "#d57282",
                borderRadius: "22px",
                boxShadow: loading ? "none" : "0 4px 14px rgba(213, 114, 130, 0.28)",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#ce5a56";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(206, 90, 86, 0.35)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = "#d57282";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(213, 114, 130, 0.28)";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: "#c4a0a5", letterSpacing: "0.04em" }}
        >
          Maeri Control Centre · Founder Access Only
        </p>
      </div>
    </div>
  );
}
