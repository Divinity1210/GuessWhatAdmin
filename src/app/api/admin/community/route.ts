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

function cleanState(state?: string | null, turf?: string | null): string {
  const s = (state || "").trim();
  if (s && s.toLowerCase() !== "unspecified") return s;
  const t = (turf || "").replace(/\s*\(.*?\)\s*/g, "").trim();
  return t || "Unspecified";
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
    const format = searchParams.get("format") || "json";
    const postIdFilter = searchParams.get("postId") || "";

    const [
      { data: posts },
      { data: votes },
      { data: messages },
      { data: ads },
      { data: mutes },
      { data: profiles },
    ] = await Promise.all([
      supabase
        .from("community_posts")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("community_poll_votes")
        .select("id, post_id, user_id, option_id, response_ms, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("community_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(150),
      supabase
        .from("community_ads")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("community_mutes")
        .select("user_id, reason, muted_until, created_at"),
      supabase
        .from("profiles")
        .select("id, username, gender, date_of_birth, state, turf"),
    ]);

    const profileMap = new Map<
      string,
      { username: string; gender: string; ageBand: string; state: string; complete: boolean }
    >();
    for (const p of profiles ?? []) {
      const gender = normalizeGender(p.gender);
      const ageBand = getAgeBand(p.date_of_birth);
      const state = cleanState(p.state, p.turf);
      const complete =
        gender !== "Unspecified" && ageBand !== "Unspecified" && state !== "Unspecified";
      profileMap.set(p.id, {
        username: p.username || "player",
        gender,
        ageBand,
        state,
        complete,
      });
    }

    // Export B2B / Government Community Poll & Sentiment CSV
    if (format === "poll_csv") {
      const targetPosts = postIdFilter
        ? (posts ?? []).filter((p) => p.id === postIdFilter)
        : posts ?? [];
      const postMap = new Map(targetPosts.map((p) => [p.id, p]));

      const lines = [
        [
          "Record_Type",
          "Topic_Category",
          "Topic_Title",
          "Sponsor",
          "Selected_Option_Or_Comment",
          "Gender",
          "Age_Band",
          "State",
          "Response_Time_Ms",
          "Timestamp",
        ].join(","),
      ];

      for (const v of votes ?? []) {
        const p = postMap.get(v.post_id);
        if (!p) continue;
        const rawOpts = Array.isArray(p.poll_options)
          ? (p.poll_options as { id: string; label: string }[])
          : [];
        const optLabel =
          rawOpts.find((o) => o.id === v.option_id)?.label || v.option_id;
        const dem = profileMap.get(v.user_id) ?? {
          gender: "Unspecified",
          ageBand: "Unspecified",
          state: "Unspecified",
        };
        lines.push(
          [
            "POLL_VOTE",
            escapeCsv(p.category),
            escapeCsv(p.title),
            escapeCsv(p.sponsor_name || "Organic"),
            escapeCsv(optLabel),
            escapeCsv(dem.gender),
            escapeCsv(dem.ageBand),
            escapeCsv(dem.state),
            escapeCsv(v.response_ms),
            escapeCsv(v.created_at),
          ].join(","),
        );
      }

      for (const m of messages ?? []) {
        if (!m.post_id || !postMap.has(m.post_id)) continue;
        const p = postMap.get(m.post_id)!;
        const dem = (m.user_id ? profileMap.get(m.user_id) : null) ?? {
          gender: "Unspecified",
          ageBand: "Unspecified",
          state: m.author_state || "Unspecified",
        };
        lines.push(
          [
            "SENTIMENT_COMMENT",
            escapeCsv(p.category),
            escapeCsv(p.title),
            escapeCsv(p.sponsor_name || "Organic"),
            escapeCsv(m.body),
            escapeCsv(dem.gender),
            escapeCsv(dem.ageBand),
            escapeCsv(dem.state),
            "0",
            escapeCsv(m.created_at),
          ].join(","),
        );
      }

      return new NextResponse(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="guesswhat_community_intelligence_${
            postIdFilter || "all"
          }.csv"`,
        },
      });
    }

    const mutedUserSet = new Set((mutes ?? []).map((m) => m.user_id));

    // Enrich posts with Option-by-Option Demographic Intelligence
    const enrichedPosts = (posts ?? []).map((p) => {
      const pVotes = (votes ?? []).filter((v) => v.post_id === p.id);
      const pReplies = (messages ?? []).filter(
        (m) => m.post_id === p.id && m.status === "visible",
      );
      const rawOpts = Array.isArray(p.poll_options)
        ? (p.poll_options as { id: string; label: string }[])
        : [];

      const totalVotes = pVotes.length;
      const optionInsights = rawOpts.map((opt) => {
        const optVotes = pVotes.filter((v) => v.option_id === opt.id);
        let male = 0;
        let female = 0;
        const ageCounts: Record<string, number> = {};
        const stateCounts: Record<string, number> = {};

        for (const ov of optVotes) {
          const dem = profileMap.get(ov.user_id);
          if (!dem) continue;
          if (dem.gender === "Male") male++;
          if (dem.gender === "Female") female++;
          if (dem.ageBand !== "Unspecified") {
            ageCounts[dem.ageBand] = (ageCounts[dem.ageBand] ?? 0) + 1;
          }
          if (dem.state !== "Unspecified") {
            stateCounts[dem.state] = (stateCounts[dem.state] ?? 0) + 1;
          }
        }

        const topAge =
          Object.entries(ageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "All ages";
        const topState =
          Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "All states";
        const knownGender = male + female;

        return {
          id: opt.id,
          label: opt.label,
          votes: optVotes.length,
          sharePct:
            totalVotes > 0 ? Number(((optVotes.length / totalVotes) * 100).toFixed(1)) : 0,
          malePct: knownGender > 0 ? Math.round((male / knownGender) * 100) : 0,
          femalePct: knownGender > 0 ? Math.round((female / knownGender) * 100) : 0,
          topAge,
          topState,
        };
      });

      return {
        id: p.id,
        kind: p.kind,
        category: p.category,
        title: p.title,
        body: p.body,
        status: p.status,
        isPinned: Boolean(p.is_pinned),
        isLocked: Boolean(p.is_locked),
        sponsorName: p.sponsor_name,
        sponsorCtaLabel: p.sponsor_cta_label,
        sponsorCtaUrl: p.sponsor_cta_url,
        totalVotes,
        replyCount: pReplies.length,
        optionInsights,
        sampleComments: pReplies.slice(0, 5).map((r) => ({
          id: r.id,
          username: r.author_username,
          state: r.author_state || "Nigeria",
          body: r.body,
          createdAt: r.created_at,
        })),
        createdAt: p.created_at,
      };
    });

    const totalImpressions = (ads ?? []).reduce(
      (s, a) => s + Number(a.impressions_count ?? 0),
      0,
    );
    const totalClicks = (ads ?? []).reduce(
      (s, a) => s + Number(a.clicks_count ?? 0),
      0,
    );

    let completeProfiles = 0;
    for (const prof of profileMap.values()) {
      if (prof.complete) completeProfiles++;
    }

    return NextResponse.json({
      summary: {
        totalPollVotes: (votes ?? []).length,
        totalMessages: (messages ?? []).length,
        publishedPosts: (posts ?? []).filter((p) => p.status === "published").length,
        activeAds: (ads ?? []).filter((a) => a.active).length,
        totalAdImpressions: totalImpressions,
        totalAdClicks: totalClicks,
        overallCtrPct:
          totalImpressions > 0
            ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
            : 0,
        demographicCompletenessPct:
          profileMap.size > 0
            ? Math.round((completeProfiles / profileMap.size) * 100)
            : 0,
      },
      posts: enrichedPosts,
      ads: (ads ?? []).map((a) => {
        const imp = Number(a.impressions_count ?? 0);
        const clk = Number(a.clicks_count ?? 0);
        return {
          id: a.id,
          placement: a.placement,
          sponsorName: a.sponsor_name,
          headline: a.headline,
          body: a.body,
          mediaUrl: a.media_url,
          ctaLabel: a.cta_label,
          ctaUrl: a.cta_url,
          adsenseSlotId: a.adsense_slot_id,
          targetStates: a.target_states ?? [],
          active: Boolean(a.active),
          impressions: imp,
          clicks: clk,
          ctrPct: imp > 0 ? Number(((clk / imp) * 100).toFixed(2)) : 0,
          createdAt: a.created_at,
        };
      }),
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        room: m.room,
        postId: m.post_id,
        userId: m.user_id,
        isSystem: Boolean(m.is_system),
        username: m.author_username,
        state: m.author_state || "Nigeria",
        rank: m.author_rank,
        body: m.body,
        status: m.status,
        isUserMuted: m.user_id ? mutedUserSet.has(m.user_id) : false,
        createdAt: m.created_at,
      })),
      mutes: (mutes ?? []).map((m) => ({
        userId: m.user_id,
        username: profileMap.get(m.user_id)?.username || m.user_id.slice(0, 8),
        reason: m.reason,
        mutedUntil: m.muted_until,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load admin community" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { action } = body;

    if (action === "create_post") {
      const {
        kind = "poll",
        category = "Banking & Fintech",
        title,
        postBody = "",
        pollOptions = [],
        isPinned = false,
        sponsorName = "",
        sponsorCtaLabel = "",
        sponsorCtaUrl = "",
      } = body;

      if (!title || !String(title).trim()) {
        return NextResponse.json({ error: "Title is required." }, { status: 400 });
      }

      const cleanOpts = Array.isArray(pollOptions)
        ? pollOptions
            .map((o: unknown) => String(o ?? "").trim())
            .filter(Boolean)
            .map((label: string, idx: number) => ({
              id: `opt_${idx + 1}_${Date.now().toString(36)}`,
              label,
            }))
        : [];

      const { data: created, error } = await supabase
        .from("community_posts")
        .insert({
          kind: cleanOpts.length >= 2 ? (sponsorName ? "sponsored_poll" : "poll") : kind,
          category,
          title: String(title).trim(),
          body: String(postBody).trim() || null,
          poll_options: cleanOpts,
          is_pinned: Boolean(isPinned),
          sponsor_name: String(sponsorName).trim() || null,
          sponsor_cta_label: String(sponsorCtaLabel).trim() || null,
          sponsor_cta_url: String(sponsorCtaUrl).trim() || null,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, post: created });
    }

    if (action === "create_ad") {
      const {
        placement = "feed",
        sponsorName,
        headline,
        adBody = "",
        mediaUrl = "",
        ctaLabel = "Learn more",
        ctaUrl = "/",
        adsenseSlotId = "",
        targetStates = [],
      } = body;

      if (!sponsorName || !headline) {
        return NextResponse.json(
          { error: "Sponsor name and headline are required." },
          { status: 400 },
        );
      }

      const { data: createdAd, error } = await supabase
        .from("community_ads")
        .insert({
          placement,
          sponsor_name: String(sponsorName).trim(),
          headline: String(headline).trim(),
          body: String(adBody).trim() || null,
          media_url: String(mediaUrl).trim() || null,
          cta_label: String(ctaLabel).trim() || "Learn more",
          cta_url: String(ctaUrl).trim() || "/",
          adsense_slot_id: String(adsenseSlotId).trim() || null,
          target_states: Array.isArray(targetStates) ? targetStates : [],
          active: true,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, ad: createdAd });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const { action } = body;

    if (action === "toggle_pin") {
      await supabase
        .from("community_posts")
        .update({ is_pinned: Boolean(body.isPinned), updated_at: new Date().toISOString() })
        .eq("id", body.postId);
      return NextResponse.json({ ok: true });
    }

    if (action === "toggle_lock") {
      await supabase
        .from("community_posts")
        .update({ is_locked: Boolean(body.isLocked), updated_at: new Date().toISOString() })
        .eq("id", body.postId);
      return NextResponse.json({ ok: true });
    }

    if (action === "archive_post") {
      await supabase
        .from("community_posts")
        .update({ status: body.status || "archived", updated_at: new Date().toISOString() })
        .eq("id", body.postId);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_post") {
      await supabase.from("community_posts").delete().eq("id", body.postId);
      return NextResponse.json({ ok: true });
    }

    if (action === "set_message_status") {
      await supabase
        .from("community_messages")
        .update({ status: body.status })
        .eq("id", body.messageId);
      return NextResponse.json({ ok: true });
    }

    if (action === "mute_user" && body.userId) {
      await supabase.from("community_mutes").upsert({
        user_id: body.userId,
        reason: body.reason || "Community spam or rule violation",
        muted_until: null,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "unmute_user" && body.userId) {
      await supabase.from("community_mutes").delete().eq("user_id", body.userId);
      return NextResponse.json({ ok: true });
    }

    if (action === "toggle_ad") {
      await supabase
        .from("community_ads")
        .update({ active: Boolean(body.active) })
        .eq("id", body.adId);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_ad") {
      await supabase.from("community_ads").delete().eq("id", body.adId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid moderation action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Moderation update failed" },
      { status: 500 },
    );
  }
}
