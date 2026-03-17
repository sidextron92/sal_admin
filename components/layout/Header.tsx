"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";

interface HeaderProps {
  title: string;
  onMobileMenuOpen: () => void;
}

export default function Header({ title, onMobileMenuOpen }: HeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header
      className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6 bg-white shrink-0"
      style={{ boxShadow: "0 1px 0 #E2E2E2, 0 2px 8px rgba(213, 114, 130, 0.04)" }}
    >
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[#f9e8eb]"
          style={{ color: "#8a8a8a" }}
          onClick={onMobileMenuOpen}
          aria-label="Open menu"
        >
          <Menu size={17} />
        </button>

        <h1 className="text-[0.9375rem] font-semibold" style={{ color: "#525252" }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{
            backgroundColor: "#d57282",
            boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px rgba(213, 114, 130, 0.3)",
          }}
        >
          F
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl transition-colors hover:bg-[#f9e8eb]"
          style={{ color: "#8a8a8a" }}
        >
          <LogOut size={14} />
          <span className="hidden sm:inline text-[0.8125rem]">Logout</span>
        </button>
      </div>
    </header>
  );
}
