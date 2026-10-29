"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const navItems = [
  { label: "Overview", href: "/admin", category: "Core" },
  { label: "Brand & Market Data", href: "/admin/insights", category: "Data Monetization" },
  { label: "Questions & Points", href: "/admin/questions", category: "Game Operations" },
  { label: "Game Sessions", href: "/admin/sessions", category: "Game Operations" },
  { label: "Players", href: "/admin/players", category: "Audience" },
  { label: "Support", href: "/admin/support", category: "Audience" },
  { label: "Settings", href: "/admin/settings", category: "System" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
                      {item.href === "/admin/insights" && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          CSV
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
          <span>admin@guesswhat.ng</span>
          <a
            href="https://guesswhat-tan.vercel.app/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline font-semibold"
          >
            Player App ↗
          </a>
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
