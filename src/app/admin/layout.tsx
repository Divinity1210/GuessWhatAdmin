"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { LogOut } from "lucide-react";

type CurrentAdmin = {
  email: string;
  username: string;
  role: string;
};

const navItems = [
  { label: "Dashboard", href: "/admin", category: "Core" },
  { label: "Live Gameplay", href: "/admin/gameplay", category: "Core" },
  { label: "Leaderboards", href: "/admin/leaderboards", category: "Core" },
  { label: "Winners & Prizes", href: "/admin/winners", category: "Core" },
  { label: "Questions & AI Bank", href: "/admin/questions", category: "Game Operations" },
  { label: "Game Sessions", href: "/admin/sessions", category: "Game Operations" },
  { label: "Brand & Market Data", href: "/admin/insights", category: "Data Monetization" },
  { label: "Community, Polls & Ads", href: "/admin/community", category: "Data Monetization" },
  { label: "Players", href: "/admin/players", category: "Audience" },
  { label: "Referrals & Promos", href: "/admin/referrals", category: "Audience" },
  { label: "Notifications & Inbox", href: "/admin/notifications", category: "Audience" },
  { label: "Customer Support", href: "/admin/support", category: "Audience" },
  { label: "Admin Users & Settings", href: "/admin/settings", category: "System" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<CurrentAdmin | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.user) {
          setCurrentAdmin(data.user);
        }
      })
      .catch(() => {
        // Handled by middleware/API gate
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div className="flex h-screen bg-[#07090e] text-slate-100 overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Clean Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-[#0b0e17] border-r border-white/5 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-amber-500 flex items-center justify-center font-black text-slate-950 text-sm">
              GW
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                GuessWhat
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Admin
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Operations &amp; Data</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto" aria-label="Admin navigation">
          {["Core", "Data Monetization", "Game Operations", "Audience", "System"].map((cat) => {
            const items = navItems.filter((i) => i.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="space-y-1">
                <div className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {cat}
                </div>
                {items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.href === "/admin/gameplay" && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          LIVE
                        </span>
                      )}
                      {item.href === "/admin/insights" && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          CSV
                        </span>
                      )}
                      {item.href === "/admin/community" && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          ADS + POLLS
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2.5 text-xs text-slate-400">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-200">
                {currentAdmin?.email || "admin@guesswhat.ng"}
              </p>
              <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                {(currentAdmin?.role || "super_admin").replace(/_/g, " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title="Sign Out"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="size-3.5" />
              <span>{signingOut ? "..." : "Out"}</span>
            </button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              @{currentAdmin?.username || "superadmin"}
            </span>
            <a
              href={`${process.env.NEXT_PUBLIC_PLAYER_APP_URL || "https://guesswhat9ja.com"}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline font-semibold"
            >
              Player App ↗
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-white/5 bg-[#0b0e17]/80 backdrop-blur-xl px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white"
            >
              ☰
            </button>
            <span className="text-xs font-medium text-slate-400">
              Free-to-Play Launch Mode · Live Crowd Data Engine
            </span>
          </div>

          <Link
            href="/admin/insights"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
          >
            <span>Brand Data &amp; CSV Export</span>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
