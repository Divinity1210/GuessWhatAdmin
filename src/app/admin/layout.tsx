"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: "⚡", category: "Core" },
  { label: "Questions", href: "/admin/questions", icon: "🧠", category: "Game Operations" },
  { label: "Sessions", href: "/admin/sessions", icon: "🎯", category: "Game Operations" },
  { label: "Players", href: "/admin/players", icon: "👑", category: "User Hub" },
  { label: "Support", href: "/admin/support", icon: "💬", category: "User Hub" },
  { label: "Billing & VAS", href: "/admin/billing", icon: "💎", category: "Financials" },
  { label: "Settings", href: "/admin/settings", icon: "⚙️", category: "System" },
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

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-[#0b0e17]/90 backdrop-blur-2xl border-r border-white/5 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-amber-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0b0e17] rounded-[10px] flex items-center justify-center font-black text-transparent bg-clip-text bg-gradient-to-tr from-indigo-400 to-amber-400 text-lg">
                GW
              </div>
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                GuessWhat
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Admin
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Control Operations</p>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
          {["Core", "Game Operations", "User Hub", "Financials", "System"].map((cat) => {
            const items = navItems.filter((i) => i.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="space-y-1">
                <div className="px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
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
                      className={`relative flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                        isActive
                          ? "bg-gradient-to-r from-indigo-600/20 via-violet-600/15 to-transparent text-white border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 w-1 h-5 bg-gradient-to-b from-indigo-400 to-amber-400 rounded-r-full" />
                      )}
                      <span
                        className={`text-lg transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? "scale-110" : "opacity-80"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 tracking-tight">{item.label}</span>
                      {isActive && (
                        <div className="size-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer Status Pill */}
        <div className="p-4 m-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse-glow" />
              Live Engine
            </span>
            <span className="text-emerald-400 font-semibold">Operational</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Connected to Supabase production node
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-white/5 bg-[#0b0e17]/80 backdrop-blur-xl px-6 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white"
            >
              ☰
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                Production Engine
              </span>
              <span>•</span>
              <span className="text-slate-400">v1.2.0</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300">
              <span className="text-amber-400 font-bold">₦</span>
              <span>System Vault: <strong className="text-white">Active</strong></span>
            </div>

            <div className="flex items-center gap-3 pl-4 border-l border-white/5">
              <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-amber-500 p-0.5 shadow-md">
                <div className="w-full h-full bg-[#0b0e17] rounded-[10px] flex items-center justify-center font-bold text-xs text-white">
                  AD
                </div>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-white tracking-tight">Super Admin</p>
                <p className="text-[10px] text-slate-400">master@guesswhat.ng</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content View */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-gradient-to-b from-[#07090e] via-[#090d16] to-[#07090e]">
          {children}
        </main>
      </div>
    </div>
  );
}
