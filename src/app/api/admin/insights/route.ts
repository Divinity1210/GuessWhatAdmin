import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function getAgeBand(dob: string | null | undefined): string {
  if (!dob) return "Unspecified";
  const birthYear = new Date(dob).getFullYear();
  if (Number.isNaN(birthYear)) return "Unspecified";
  const age = new Date().getFullYear() - birthYear;
  if (age < 18) return "Under 18";
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  return "45+";
}

function normalizeGender(g: string | null | undefined): string {
  if (!g) return "Unspecified";
  const clean = g.trim().toLowerCase();
  if (clean === "male" || clean === "m") return "Male";
  if (clean === "female" || clean === "f") return "Female";
  return "Other";
}

function escapeCsv(val: string | number | null | undefined): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);

    const categoryFilter = searchParams.get("category") || "all";
    const sessionFilter = searchParams.get("sessionId") || "all";
    const genderFilter = searchParams.get("gender") || "all";
    const ageFilter = searchParams.get("ageBand") || "all";
    const stateFilter = searchParams.get("state") || "all";
    const questionFilter = searchParams.get("questionId") || "all";
    const format = searchParams.get("format") || "json";

    const [
      { data: questions },
      { data: answers },
      { data: profiles },
      { data: sessions },
    ] = await Promise.all([
      supabase
        .from("questions")
        .select("id, title, category, type, status, question_options(id, label, position, media_url)")
        .order("created_at", { ascending: false }),
      supabase
        .from("answers")
        .select("id, session_id, user_id, question_id, option_id, response_ms, answered_at")
        .order("answered_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, gender, date_of_birth, state"),
      supabase
        .from("game_sessions")
        .select("id, name, status, starts_at")
        .order("starts_at", { ascending: false }),
    ]);

    const profileMap = new Map<
      string,
      { gender: string; ageBand: string; state: string; complete: boolean }
    >();
    const allStatesSet = new Set<string>();

    for (const p of profiles ?? []) {
      const gender = normalizeGender(p.gender);
      const ageBand = getAgeBand(p.date_of_birth);
      const state = p.state?.trim() || "Unspecified";
      if (state !== "Unspecified") allStatesSet.add(state);
      const complete =
        gender !== "Unspecified" && ageBand !== "Unspecified" && state !== "Unspecified";
      profileMap.set(p.id, { gender, ageBand, state, complete });
    }

    const sessionMap = new Map<string, string>();
    for (const s of sessions ?? []) {
      sessionMap.set(s.id, s.name);
    }

    const questionMap = new Map<
      string,
      {
        id: string;
        title: string;
        category: string;
        type: string;
        options: { id: string; label: string; position: number; media_url?: string | null }[];
      }
    >();
    const allCategoriesSet = new Set<string>();

    for (const q of questions ?? []) {
      if (q.category) allCategoriesSet.add(q.category);
      const sortedOpts = [...(q.question_options ?? [])].sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      );
      questionMap.set(q.id, {
        id: q.id,
        title: q.title,
        category: q.category || "General",
        type: q.type || "text",
        options: sortedOpts,
      });
    }

    // Filter answers based on demographic and session/category slicers
    const filteredAnswers = (answers ?? []).filter((ans) => {
      const q = questionMap.get(ans.question_id);
      if (!q) return false;
      if (categoryFilter !== "all" && q.category !== categoryFilter) return false;
      if (questionFilter !== "all" && q.id !== questionFilter) return false;
      if (sessionFilter !== "all" && ans.session_id !== sessionFilter) return false;

      const dem = profileMap.get(ans.user_id) ?? {
        gender: "Unspecified",
        ageBand: "Unspecified",
        state: "Unspecified",
        complete: false,
      };

      if (genderFilter !== "all" && dem.gender.toLowerCase() !== genderFilter.toLowerCase()) {
        return false;
      }
      if (ageFilter !== "all" && dem.ageBand !== ageFilter) {
        return false;
      }
      if (stateFilter !== "all" && dem.state.toLowerCase() !== stateFilter.toLowerCase()) {
        return false;
      }
      return true;
    });

    // Overall demographic distributions across filtered answers
    const genderCounts: Record<string, number> = { Male: 0, Female: 0, Unspecified: 0 };
    const ageCounts: Record<string, number> = {
      "18-24": 0,
      "25-34": 0,
      "35-44": 0,
      "45+": 0,
      Unspecified: 0,
    };
    const stateCounts: Record<string, number> = {};
    const respondentSet = new Set<string>();
    let completeCount = 0;
    let totalResponseMs = 0;

    for (const ans of filteredAnswers) {
      respondentSet.add(ans.user_id);
      totalResponseMs += Number(ans.response_ms ?? 0);
      const dem = profileMap.get(ans.user_id) ?? {
        gender: "Unspecified",
        ageBand: "Unspecified",
        state: "Unspecified",
        complete: false,
      };
      genderCounts[dem.gender] = (genderCounts[dem.gender] ?? 0) + 1;
      ageCounts[dem.ageBand] = (ageCounts[dem.ageBand] ?? 0) + 1;
      stateCounts[dem.state] = (stateCounts[dem.state] ?? 0) + 1;
      if (dem.complete) completeCount++;
    }

    // Group answers by option_id for per-question brand intelligence
    const optionStats = new Map<
      string,
      {
        count: number;
        totalMs: number;
        male: number;
        female: number;
        ages: Record<string, number>;
        states: Record<string, number>;
      }
    >();

    for (const ans of filteredAnswers) {
      const cur = optionStats.get(ans.option_id) ?? {
        count: 0,
        totalMs: 0,
        male: 0,
        female: 0,
        ages: {},
        states: {},
      };
      cur.count += 1;
      cur.totalMs += Number(ans.response_ms ?? 0);
      const dem = profileMap.get(ans.user_id);
      if (dem) {
        if (dem.gender === "Male") cur.male += 1;
        if (dem.gender === "Female") cur.female += 1;
        cur.ages[dem.ageBand] = (cur.ages[dem.ageBand] ?? 0) + 1;
        cur.states[dem.state] = (cur.states[dem.state] ?? 0) + 1;
      }
      optionStats.set(ans.option_id, cur);
    }

    // Build structured question insights
    const questionInsights = Array.from(questionMap.values())
      .filter((q) => {
        if (categoryFilter !== "all" && q.category !== categoryFilter) return false;
        if (questionFilter !== "all" && q.id !== questionFilter) return false;
        return true;
      })
      .map((q) => {
        const totalQ = q.options.reduce(
          (sum, opt) => sum + (optionStats.get(opt.id)?.count ?? 0),
          0
        );

        // Rank options by count DESC, tie-broken by position ASC
        const ranked = [...q.options].sort((a, b) => {
          const diff =
            (optionStats.get(b.id)?.count ?? 0) - (optionStats.get(a.id)?.count ?? 0);
          return diff !== 0 ? diff : a.position - b.position;
        });

        const pointsMap = new Map<string, { rank: number; points: number }>();
        ranked.forEach((opt, idx) => {
          pointsMap.set(opt.id, { rank: idx + 1, points: Math.max(10 - idx, 1) });
        });

        const enrichedOptions = ranked.map((opt) => {
          const st = optionStats.get(opt.id);
          const count = st?.count ?? 0;
          const sharePct = totalQ > 0 ? Number(((count / totalQ) * 100).toFixed(1)) : 0;
          const avgMs = count > 0 ? Math.round((st?.totalMs ?? 0) / count) : 0;
          const rk = pointsMap.get(opt.id) ?? { rank: 10, points: 1 };

          const topAge =
            Object.entries(st?.ages ?? {})
              .filter(([k]) => k !== "Unspecified")
              .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "All Ages";
          const topState =
            Object.entries(st?.states ?? {})
              .filter(([k]) => k !== "Unspecified")
              .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "National";
          const genderLead =
            (st?.male ?? 0) === 0 && (st?.female ?? 0) === 0
              ? "Balanced"
              : (st?.female ?? 0) > (st?.male ?? 0)
              ? "Female-skewed"
              : (st?.male ?? 0) > (st?.female ?? 0)
              ? "Male-skewed"
              : "50/50 Split";

          const mfTotal = (st?.male ?? 0) + (st?.female ?? 0);
          const malePct = mfTotal > 0 ? Math.round(((st?.male ?? 0) / mfTotal) * 100) : 0;
          const femalePct = mfTotal > 0 ? Math.round(((st?.female ?? 0) / mfTotal) * 100) : 0;

          return {
            id: opt.id,
            label: opt.label,
            media_url: opt.media_url,
            rank: rk.rank,
            points: rk.points,
            responses: count,
            sharePct,
            avgResponseMs: avgMs,
            malePct,
            femalePct,
            topAge,
            topState,
            topSegment: count > 0 ? `${genderLead} · ${topAge} · ${topState}` : "No data yet",
          };
        });

        return {
          id: q.id,
          title: q.title,
          category: q.category,
          type: q.type,
          totalResponses: totalQ,
          options: enrichedOptions,
        };
      });

    // 1. Export Aggregated Brand Summary CSV
    if (format === "summary_csv") {
      const header = [
        "Category",
        "Question",
        "Format",
        "Option",
        "Crowd_Rank",
        "Crowd_Points",
        "Responses",
        "Market_Share_Pct",
        "Avg_Response_Seconds",
        "Male_Share_Pct",
        "Female_Share_Pct",
        "Leading_Age_Bracket",
        "Leading_State",
      ];
      const rows = [header.join(",")];

      for (const q of questionInsights) {
        for (const opt of q.options) {
          rows.push(
            [
              escapeCsv(q.category),
              escapeCsv(q.title),
              escapeCsv(q.type),
              escapeCsv(opt.label),
              opt.rank,
              opt.points,
              opt.responses,
              opt.sharePct,
              (opt.avgResponseMs / 1000).toFixed(2),
              opt.malePct,
              opt.femalePct,
              escapeCsv(opt.topAge),
              escapeCsv(opt.topState),
            ].join(",")
          );
        }
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat-brand-summary-${dateStr}.csv"`,
        },
      });
    }

    // 2. Export Clean Anonymized Respondent-Level Microdata CSV (Zero PII)
    if (format === "raw_csv") {
      const header = [
        "Response_ID",
        "Answered_At",
        "Session_Name",
        "Category",
        "Question",
        "Selected_Option",
        "Crowd_Points",
        "Response_Time_Ms",
        "Anonymized_Respondent_ID",
        "Gender",
        "Age_Bracket",
        "Location_State",
      ];
      const rows = [header.join(",")];

      // Quick lookup for option label & points
      const optMeta = new Map<string, { label: string; points: number }>();
      for (const q of questionInsights) {
        for (const o of q.options) {
          optMeta.set(o.id, { label: o.label, points: o.points });
        }
      }

      for (const ans of filteredAnswers) {
        const q = questionMap.get(ans.question_id);
        const meta = optMeta.get(ans.option_id);
        const dem = profileMap.get(ans.user_id) ?? {
          gender: "Unspecified",
          ageBand: "Unspecified",
          state: "Unspecified",
        };
        const anonHash = `resp_${String(ans.user_id).replace(/-/g, "").slice(0, 10)}`;

        rows.push(
          [
            escapeCsv(ans.id),
            escapeCsv(ans.answered_at),
            escapeCsv(sessionMap.get(ans.session_id) || ans.session_id),
            escapeCsv(q?.category || "General"),
            escapeCsv(q?.title || ""),
            escapeCsv(meta?.label || ""),
            meta?.points ?? 1,
            ans.response_ms ?? 0,
            escapeCsv(anonHash),
            escapeCsv(dem.gender),
            escapeCsv(dem.ageBand),
            escapeCsv(dem.state),
          ].join(",")
        );
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      return new NextResponse(rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat-anonymized-microdata-${dateStr}.csv"`,
        },
      });
    }

    const totalResponses = filteredAnswers.length;
    const avgResponseMs =
      totalResponses > 0 ? Math.round(totalResponseMs / totalResponses) : 0;
    const demographicCompletenessPct =
      totalResponses > 0 ? Math.round((completeCount / totalResponses) * 100) : 100;

    return NextResponse.json({
      summary: {
        totalResponses,
        uniqueRespondents: respondentSet.size,
        avgResponseMs,
        demographicCompletenessPct,
      },
      demographics: {
        byGender: genderCounts,
        byAgeBand: ageCounts,
        byState: stateCounts,
      },
      filters: {
        categories: Array.from(allCategoriesSet).sort(),
        states: Array.from(allStatesSet).sort(),
        sessions: (sessions ?? []).map((s) => ({ id: s.id, name: s.name })),
      },
      questions: questionInsights,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute brand insights" },
      { status: 500 }
    );
  }
}
