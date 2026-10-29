"use client";

import { useEffect, useState } from "react";

type OptionInsight = {
  id: string;
  label: string;
  media_url?: string | null;
  rank: number;
  points: number;
  responses: number;
  sharePct: number;
  avgResponseMs: number;
  malePct: number;
  femalePct: number;
  topAge: string;
  topState: string;
  topSegment: string;
};

type QuestionInsight = {
  id: string;
  title: string;
  category: string;
  type: string;
  totalResponses: number;
  options: OptionInsight[];
};

type InsightsPayload = {
  summary: {
    totalResponses: number;
    uniqueRespondents: number;
    avgResponseMs: number;
    demographicCompletenessPct: number;
  };
  demographics: {
    byGender: Record<string, number>;
    byAgeBand: Record<string, number>;
    byState: Record<string, number>;
  };
  filters: {
    categories: string[];
    states: string[];
    sessions: { id: string; name: string }[];
  };
  questions: QuestionInsight[];
};

export default function BrandInsightsPage() {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Clean Demographic & Category Slicers
  const [category, setCategory] = useState("all");
  const [sessionId, setSessionId] = useState("all");
  const [gender, setGender] = useState("all");
  const [ageBand, setAgeBand] = useState("all");
  const [stateLoc, setStateLoc] = useState("all");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  const buildQueryString = (extraFormat?: "summary_csv" | "raw_csv") => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (sessionId !== "all") params.set("sessionId", sessionId);
    if (gender !== "all") params.set("gender", gender);
    if (ageBand !== "all") params.set("ageBand", ageBand);
    if (stateLoc !== "all") params.set("state", stateLoc);
    if (extraFormat) params.set("format", extraFormat);
    return params.toString();
  };

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const qs = buildQueryString();
        const res = await fetch(`/api/admin/insights?${qs}`, { cache: "no-store" });
        const json = (await res.json()) as InsightsPayload;
        if (!active) return;
        setData(json);
        if (json.questions?.length > 0) {
          const exists = json.questions.some((q) => q.id === selectedQuestionId);
          if (!exists) {
            setSelectedQuestionId(json.questions[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load insights:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [category, sessionId, gender, ageBand, stateLoc]);

  const activeQuestion =
    data?.questions.find((q) => q.id === selectedQuestionId) ??
    data?.questions[0] ??
    null;

  const resetFilters = () => {
    setCategory("all");
    setSessionId("all");
    setGender("all");
    setAgeBand("all");
    setStateLoc("all");
  };

  const hasActiveFilter =
    category !== "all" ||
    sessionId !== "all" ||
    gender !== "all" ||
    ageBand !== "all" ||
    stateLoc !== "all";

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header & Clean 1-Click CSV Exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300 mb-2">
            Consumer &amp; Brand Intelligence
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Clean Market Data &amp; Exports
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Slice crowd preferences by gender, age, and state, and export clean, PII-free datasets for brand partners.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`/api/admin/insights?${buildQueryString("summary_csv")}`}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors"
          >
            <span>↓ Export Brand Summary (CSV)</span>
          </a>
          <a
            href={`/api/admin/insights?${buildQueryString("raw_csv")}`}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold text-xs sm:text-sm transition-colors"
          >
            <span>↓ Export Anonymized Microdata (CSV)</span>
          </a>
        </div>
      </div>

      {/* Demographic & Category Slicer Bar */}
      <div className="rounded-3xl bg-[#0f1219] border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Audience &amp; Topic Filters
          </p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300"
            >
              Reset all filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label
              htmlFor="filter-category"
              className="block text-[11px] font-semibold text-slate-400 mb-1"
            >
              Category
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e17] px-3 py-2.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {(data?.filters.categories ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-gender"
              className="block text-[11px] font-semibold text-slate-400 mb-1"
            >
              Gender
            </label>
            <select
              id="filter-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e17] px-3 py-2.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-age"
              className="block text-[11px] font-semibold text-slate-400 mb-1"
            >
              Age Bracket
            </label>
            <select
              id="filter-age"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e17] px-3 py-2.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Age Brackets</option>
              <option value="18-24">18 – 24 (Gen Z)</option>
              <option value="25-34">25 – 34 (Millennial)</option>
              <option value="35-44">35 – 44</option>
              <option value="45+">45+</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-state"
              className="block text-[11px] font-semibold text-slate-400 mb-1"
            >
              Location (State)
            </label>
            <select
              id="filter-state"
              value={stateLoc}
              onChange={(e) => setStateLoc(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e17] px-3 py-2.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Locations</option>
              {(data?.filters.states ?? []).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-session"
              className="block text-[11px] font-semibold text-slate-400 mb-1"
            >
              Game Session
            </label>
            <select
              id="filter-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e17] px-3 py-2.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Sessions</option>
              {(data?.filters.sessions ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Clean Sample Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5">
          <p className="text-xs font-semibold text-slate-400">Clean Responses (n)</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tabular-nums">
            {(data?.summary.totalResponses ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Verified crowd selections</p>
        </div>

        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5">
          <p className="text-xs font-semibold text-slate-400">Unique Respondents</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1 tabular-nums">
            {(data?.summary.uniqueRespondents ?? 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Distinct players in sample</p>
        </div>

        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5">
          <p className="text-xs font-semibold text-slate-400">Avg Instinct Latency</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1 tabular-nums">
            {((data?.summary.avgResponseMs ?? 0) / 1000).toFixed(2)}s
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Top-of-mind recall speed</p>
        </div>

        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5">
          <p className="text-xs font-semibold text-slate-400">Demographic Coverage</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1 tabular-nums">
            {data?.summary.demographicCompletenessPct ?? 100}%
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Age, gender &amp; state linked</p>
        </div>
      </div>

      {/* Question Selector + Deep Brand Preference Table */}
      <div className="rounded-3xl bg-[#0f1219] border border-white/10 p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex-1">
            <label
              htmlFor="select-insight-question"
              className="block text-xs font-bold uppercase tracking-wider text-amber-400 mb-2"
            >
              Select Question to Inspect Brand / Option Share
            </label>
            <select
              id="select-insight-question"
              value={activeQuestion?.id ?? ""}
              onChange={(e) => setSelectedQuestionId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e17] px-4 py-3 text-sm font-bold text-white focus:border-amber-500 focus:outline-none"
            >
              {(data?.questions ?? []).map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.category}] {q.title} ({q.totalResponses} responses)
                </option>
              ))}
            </select>
          </div>

          {activeQuestion && (
            <div className="text-left md:text-right shrink-0">
              <p className="text-xs text-slate-400">Question Sample Size</p>
              <p className="text-2xl font-black text-white tabular-nums">
                {activeQuestion.totalResponses.toLocaleString()} responses
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Computing clean market intelligence...
          </div>
        ) : !activeQuestion ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No questions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3 pr-4">Rank</th>
                  <th className="py-3 px-4">Option / Brand Choice</th>
                  <th className="py-3 px-4 w-64">Preference Share</th>
                  <th className="py-3 px-4 text-right">Responses</th>
                  <th className="py-3 px-4 text-right">Crowd Points</th>
                  <th className="py-3 px-4 text-right">Avg Speed</th>
                  <th className="py-3 pl-4 text-right">Leading Audience</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeQuestion.options.map((opt) => (
                  <tr key={opt.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 pr-4 font-mono text-xs font-bold text-slate-400">
                      #{opt.rank}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        {activeQuestion.type === "color" && opt.media_url && (
                          <span
                            className="size-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: opt.media_url }}
                          />
                        )}
                        <span>{opt.label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              opt.rank === 1
                                ? "bg-emerald-400"
                                : opt.rank <= 3
                                ? "bg-amber-400"
                                : "bg-indigo-400/70"
                            }`}
                            style={{ width: `${Math.max(opt.sharePct, 2)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs font-bold text-white tabular-nums">
                          {opt.sharePct}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-300 tabular-nums">
                      {opt.responses.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-white/5 text-xs font-bold text-amber-300 tabular-nums">
                        {opt.points} {opt.points === 1 ? "pt" : "pts"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-300 tabular-nums">
                      {opt.responses > 0 ? `${(opt.avgResponseMs / 1000).toFixed(2)}s` : "—"}
                    </td>
                    <td className="py-3.5 pl-4 text-right text-xs text-slate-300">
                      {opt.topSegment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clean 3-Column Audience Demographic Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Gender Split */}
        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Sample by Gender
          </h3>
          <div className="space-y-2.5">
            {Object.entries(data?.demographics.byGender ?? {})
              .filter(([, count]) => count > 0)
              .map(([g, count]) => {
                const total = Math.max(data?.summary.totalResponses ?? 1, 1);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={g} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{g}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Age Bracket Split */}
        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Sample by Age Bracket
          </h3>
          <div className="space-y-2.5">
            {Object.entries(data?.demographics.byAgeBand ?? {})
              .filter(([, count]) => count > 0)
              .map(([band, count]) => {
                const total = Math.max(data?.summary.totalResponses ?? 1, 1);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={band} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{band}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Top Locations / States */}
        <div className="rounded-2xl bg-[#0f1219] border border-white/10 p-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Sample by State / Location
          </h3>
          <div className="space-y-2.5">
            {Object.entries(data?.demographics.byState ?? {})
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([st, count]) => {
                const total = Math.max(data?.summary.totalResponses ?? 1, 1);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={st} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{st}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
