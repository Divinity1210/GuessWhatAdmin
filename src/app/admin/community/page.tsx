"use client";

import { useEffect, useState, useCallback } from "react";

type OptionInsight = {
  id: string;
  label: string;
  votes: number;
  sharePct: number;
  malePct: number;
  femalePct: number;
  topAge: string;
  topState: string;
};

type AdminPost = {
  id: string;
  kind: string;
  category: string;
  title: string;
  body: string | null;
  status: string;
  isPinned: boolean;
  isLocked: boolean;
  sponsorName: string | null;
  sponsorCtaLabel: string | null;
  sponsorCtaUrl: string | null;
  totalVotes: number;
  replyCount: number;
  optionInsights: OptionInsight[];
  sampleComments: {
    id: number;
    username: string;
    state: string;
    body: string;
    createdAt: string;
  }[];
  createdAt: string;
};

type AdminAd = {
  id: string;
  placement: "feed" | "chat_banner" | "sidebar";
  sponsorName: string;
  headline: string;
  body: string | null;
  mediaUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
  adsenseSlotId: string | null;
  targetStates: string[];
  active: boolean;
  impressions: number;
  clicks: number;
  ctrPct: number;
  createdAt: string;
};

type AdminMessage = {
  id: number;
  room: string;
  postId: string | null;
  userId: string | null;
  isSystem: boolean;
  username: string;
  state: string;
  rank: number | null;
  body: string;
  status: string;
  isUserMuted: boolean;
  createdAt: string;
};

type AdminMute = {
  userId: string;
  username: string;
  reason: string | null;
  mutedUntil: string | null;
  createdAt: string;
};

async function compressImageFile(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image file"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminCommunityPage() {
  const [tab, setTab] = useState<"polls" | "ads" | "moderation">("polls");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalPollVotes: 0,
    totalMessages: 0,
    publishedPosts: 0,
    activeAds: 0,
    totalAdImpressions: 0,
    totalAdClicks: 0,
    overallCtrPct: 0,
    demographicCompletenessPct: 0,
  });
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [ads, setAds] = useState<AdminAd[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [mutes, setMutes] = useState<AdminMute[]>([]);

  // New Poll / Topic Form
  const [showPostForm, setShowPostForm] = useState(false);
  const [postCategory, setPostCategory] = useState("Banking & Fintech");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postOptions, setPostOptions] = useState<string[]>(["", "", "", ""]);
  const [postPinned, setPostPinned] = useState(false);
  const [postSponsorName, setPostSponsorName] = useState("");
  const [postSponsorCtaLabel, setPostSponsorCtaLabel] = useState("Learn more");
  const [postSponsorCtaUrl, setPostSponsorCtaUrl] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  // New Native Ad Form
  const [showAdForm, setShowAdForm] = useState(false);
  const [adPlacement, setAdPlacement] = useState<"feed" | "chat_banner">("feed");
  const [adSponsor, setAdSponsor] = useState("");
  const [adHeadline, setAdHeadline] = useState("");
  const [adBody, setAdBody] = useState("");
  const [adMediaUrl, setAdMediaUrl] = useState("");
  const [adCtaLabel, setAdCtaLabel] = useState("Learn more");
  const [adCtaUrl, setAdCtaUrl] = useState("");
  const [adAdsenseId, setAdAdsenseId] = useState("");
  const [adStatesRaw, setAdStatesRaw] = useState("");
  const [savingAd, setSavingAd] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/community", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary);
        setPosts(json.posts ?? []);
        setAds(json.ads ?? []);
        setMessages(json.messages ?? []);
        setMutes(json.mutes ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim()) return;
    setSavingPost(true);
    try {
      const cleanOpts = postOptions.map((o) => o.trim()).filter(Boolean);
      const res = await fetch("/api/admin/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_post",
          kind: cleanOpts.length >= 2 ? "poll" : "topic",
          category: postCategory,
          title: postTitle,
          postBody,
          pollOptions: cleanOpts,
          isPinned: postPinned,
          sponsorName: postSponsorName,
          sponsorCtaLabel: postSponsorCtaLabel,
          sponsorCtaUrl: postSponsorCtaUrl,
        }),
      });
      if (res.ok) {
        setShowPostForm(false);
        setPostTitle("");
        setPostBody("");
        setPostOptions(["", "", "", ""]);
        setPostPinned(false);
        setPostSponsorName("");
        setPostSponsorCtaUrl("");
        await loadData();
      }
    } finally {
      setSavingPost(false);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adSponsor.trim() || !adHeadline.trim()) return;
    setSavingAd(true);
    try {
      const targetStates = adStatesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/admin/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_ad",
          placement: adPlacement,
          sponsorName: adSponsor,
          headline: adHeadline,
          adBody,
          mediaUrl: adMediaUrl,
          ctaLabel: adCtaLabel,
          ctaUrl: adCtaUrl || "/",
          adsenseSlotId: adAdsenseId,
          targetStates,
        }),
      });
      if (res.ok) {
        setShowAdForm(false);
        setAdSponsor("");
        setAdHeadline("");
        setAdBody("");
        setAdMediaUrl("");
        setAdCtaUrl("");
        setAdAdsenseId("");
        setAdStatesRaw("");
        await loadData();
      }
    } finally {
      setSavingAd(false);
    }
  };

  const runPatch = async (payload: Record<string, unknown>) => {
    await fetch("/api/admin/community", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Community, Pulse Polls &amp; Native Ads
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Run consumer &amp; public-policy research polls, manage sponsored placements, and moderate live banter.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/api/admin/community?format=poll_csv"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
          >
            Export All Poll &amp; Sentiment CSV
          </a>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0b0e17] p-4">
          <p className="text-xs text-slate-400">Pulse Poll Votes (Data Points)</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {summary.totalPollVotes.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-emerald-400">
            {summary.demographicCompletenessPct}% full demographic tags
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0b0e17] p-4">
          <p className="text-xs text-slate-400">Live Chat &amp; Thread Replies</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {summary.totalMessages.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {summary.publishedPosts} active polls &amp; topics
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0b0e17] p-4">
          <p className="text-xs text-slate-400">Ad Impressions Served</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {summary.totalAdImpressions.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-amber-300">
            {summary.activeAds} active ad placements
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0b0e17] p-4">
          <p className="text-xs text-slate-400">Ad Clicks &amp; CTR</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {summary.totalAdClicks.toLocaleString()}{" "}
            <span className="text-sm font-semibold text-amber-400">
              ({summary.overallCtrPct}%)
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Feed + Live Chat Banner</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] pb-3">
        {[
          { id: "polls", label: `Polls, Topics & Data (${posts.length})` },
          { id: "ads", label: `Native Ads & Sponsors (${ads.length})` },
          { id: "moderation", label: `Live Banter Moderation (${messages.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as "polls" | "ads" | "moderation")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              tab === t.id
                ? "bg-amber-500 text-slate-950"
                : "bg-white/5 text-slate-300 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PULSE POLLS, TOPICS & B2B/GOV DATA */}
      {tab === "polls" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              Research Polls, Sponsored Debates &amp; Verdict Threads
            </h2>
            <button
              type="button"
              onClick={() => setShowPostForm(!showPostForm)}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              {showPostForm ? "Close form" : "+ Create Poll or Sponsored Topic"}
            </button>
          </div>

          {showPostForm && (
            <form
              onSubmit={handleCreatePost}
              className="rounded-2xl border border-amber-500/30 bg-[#0b0e17] p-5 space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Industry / Research Category
                  </label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  >
                    {[
                      "Banking & Fintech",
                      "Telecoms & Data",
                      "Economy & Policy",
                      "FMCG & Retail",
                      "Food & Culture",
                      "Sports & Music",
                      "Game Banter",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sponsor Brand Name (leave blank if organic)
                  </label>
                  <input
                    type="text"
                    value={postSponsorName}
                    onChange={(e) => setPostSponsorName(e.target.value)}
                    placeholder="e.g. Moniepoint / MTN / Lagos State"
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Sponsor CTA URL (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={postSponsorCtaLabel}
                      onChange={(e) => setPostSponsorCtaLabel(e.target.value)}
                      placeholder="CTA Label"
                      className="w-28 rounded-xl border border-white/10 bg-[#07090e] px-2.5 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={postSponsorCtaUrl}
                      onChange={(e) => setPostSponsorCtaUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Poll Question or Debate Headline
                </label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g. Which digital bank gives your small business the most reliable POS settlement?"
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supporting Prompt (encourages qualitative sentiment replies)
                </label>
                <textarea
                  rows={2}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Ask players to share their city and why they chose that option..."
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Poll Options (fill 2+ options for a structured poll, or leave blank for an open discussion thread)
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {postOptions.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const next = [...postOptions];
                        next[idx] = e.target.value;
                        setPostOptions(next);
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  ))}
                </div>
                {postOptions.length < 8 && (
                  <button
                    type="button"
                    onClick={() => setPostOptions([...postOptions, ""])}
                    className="mt-2 text-xs font-semibold text-amber-400 hover:underline"
                  >
                    + Add another option
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={postPinned}
                    onChange={(e) => setPostPinned(e.target.checked)}
                    className="size-4 accent-amber-500"
                  />
                  <span>Pin to top of Community Arena feed</span>
                </label>

                <button
                  type="submit"
                  disabled={savingPost}
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {savingPost ? "Publishing..." : "Publish Poll / Topic"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-xs text-slate-400">Loading community intelligence...</p>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0b0e17] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-slate-200">
                          {p.category}
                        </span>
                        {p.sponsorName && (
                          <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 font-bold text-sky-300">
                            Sponsored · {p.sponsorName}
                          </span>
                        )}
                        {p.isPinned && (
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">
                            Pinned
                          </span>
                        )}
                        {p.isLocked && (
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 font-bold text-rose-300">
                            Locked
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-bold text-white">{p.title}</h3>
                      {p.body && <p className="mt-1 text-xs text-slate-400">{p.body}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <a
                        href={`/api/admin/community?format=poll_csv&postId=${p.id}`}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        CSV ({p.totalVotes} votes · {p.replyCount} comments)
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          runPatch({
                            action: "toggle_pin",
                            postId: p.id,
                            isPinned: !p.isPinned,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 hover:text-white"
                      >
                        {p.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runPatch({
                            action: "toggle_lock",
                            postId: p.id,
                            isLocked: !p.isLocked,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 hover:text-white"
                      >
                        {p.isLocked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runPatch({ action: "delete_post", postId: p.id })
                        }
                        className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-rose-300 hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Demographic Option Breakdown Table */}
                  {p.optionInsights.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#07090e]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/[0.07] text-slate-400">
                            <th className="px-3.5 py-2.5">Option</th>
                            <th className="px-3.5 py-2.5">Votes</th>
                            <th className="px-3.5 py-2.5">Share</th>
                            <th className="px-3.5 py-2.5">Gender Split</th>
                            <th className="px-3.5 py-2.5">Leading Age</th>
                            <th className="px-3.5 py-2.5">Leading State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.optionInsights.map((opt) => (
                            <tr
                              key={opt.id}
                              className="border-b border-white/[0.04] last:border-b-0 text-slate-200"
                            >
                              <td className="px-3.5 py-2.5 font-semibold text-white">
                                {opt.label}
                              </td>
                              <td className="px-3.5 py-2.5">{opt.votes}</td>
                              <td className="px-3.5 py-2.5 font-bold text-amber-300">
                                {opt.sharePct}%
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-300">
                                {opt.malePct || opt.femalePct
                                  ? `${opt.malePct}% M / ${opt.femalePct}% F`
                                  : "—"}
                              </td>
                              <td className="px-3.5 py-2.5 text-slate-300">{opt.topAge}</td>
                              <td className="px-3.5 py-2.5 text-slate-300">{opt.topState}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {p.sampleComments.length > 0 && (
                    <div className="space-y-1.5 rounded-xl bg-[#07090e] p-3 border border-white/[0.05]">
                      <p className="text-[11px] font-semibold text-slate-400">
                        Recent qualitative sentiment replies ({p.replyCount}):
                      </p>
                      {p.sampleComments.map((c) => (
                        <p key={c.id} className="text-xs text-slate-300">
                          <span className="font-bold text-white">{c.username}</span>{" "}
                          <span className="text-slate-500">({c.state}):</span> {c.body}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NATIVE ADS & SPONSORS */}
      {tab === "ads" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">
                Native Ad Cards &amp; Live Chat Banners
              </h2>
              <p className="text-xs text-slate-400">
                Upload direct sponsor creatives or attach Google AdSense slot IDs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdForm(!showAdForm)}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              {showAdForm ? "Close form" : "+ New Sponsor / Ad Placement"}
            </button>
          </div>

          {showAdForm && (
            <form
              onSubmit={handleCreateAd}
              className="rounded-2xl border border-amber-500/30 bg-[#0b0e17] p-5 space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Placement Slot
                  </label>
                  <select
                    value={adPlacement}
                    onChange={(e) =>
                      setAdPlacement(e.target.value as "feed" | "chat_banner")
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  >
                    <option value="feed">In-Feed Native Sponsor Card</option>
                    <option value="chat_banner">Pinned Top Live Chat Banner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Advertiser / Sponsor Name
                  </label>
                  <input
                    type="text"
                    required
                    value={adSponsor}
                    onChange={(e) => setAdSponsor(e.target.value)}
                    placeholder="e.g. OPay / Pepsi Nigeria"
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Geo-Target States (comma-separated, blank = Nationwide)
                  </label>
                  <input
                    type="text"
                    value={adStatesRaw}
                    onChange={(e) => setAdStatesRaw(e.target.value)}
                    placeholder="e.g. Lagos, Abuja (FCT), Rivers"
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Ad Headline
                  </label>
                  <input
                    type="text"
                    required
                    value={adHeadline}
                    onChange={(e) => setAdHeadline(e.target.value)}
                    placeholder="Zero transfer fees all weekend on OPay"
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      CTA Button
                    </label>
                    <input
                      type="text"
                      value={adCtaLabel}
                      onChange={(e) => setAdCtaLabel(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Destination Link
                    </label>
                    <input
                      type="text"
                      required
                      value={adCtaUrl}
                      onChange={(e) => setAdCtaUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Supporting Ad Copy (optional)
                </label>
                <input
                  type="text"
                  value={adBody}
                  onChange={(e) => setAdBody(e.target.value)}
                  placeholder="Short description shown on In-Feed Native Cards..."
                  className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Upload Banner Creative (Direct Image Upload — optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await compressImageFile(file);
                      setAdMediaUrl(dataUrl);
                    }}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-amber-300"
                  />
                  {adMediaUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={adMediaUrl}
                        alt="Ad preview"
                        className="h-14 w-24 rounded-lg object-cover border border-white/10"
                      />
                      <button
                        type="button"
                        onClick={() => setAdMediaUrl("")}
                        className="text-xs text-rose-400 hover:underline"
                      >
                        Remove image
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Google AdSense Slot ID (optional)
                  </label>
                  <input
                    type="text"
                    value={adAdsenseId}
                    onChange={(e) => setAdAdsenseId(e.target.value)}
                    placeholder="e.g. 8492019384"
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingAd}
                  className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {savingAd ? "Saving..." : "Launch Ad Placement"}
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0b0e17]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-slate-400">
                  <th className="px-4 py-3">Sponsor &amp; Headline</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Geo-Target</th>
                  <th className="px-4 py-3">Impressions</th>
                  <th className="px-4 py-3">Clicks (CTR)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr
                    key={ad.id}
                    className="border-b border-white/[0.04] last:border-b-0 text-slate-200"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{ad.sponsorName}</p>
                      <p className="text-slate-400 line-clamp-1">{ad.headline}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-white/10 px-2 py-0.5 font-semibold">
                        {ad.placement === "chat_banner" ? "Live Chat Banner" : "In-Feed Card"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {ad.targetStates.length > 0
                        ? ad.targetStates.join(", ")
                        : "Nationwide"}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {ad.impressions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-300">
                      {ad.clicks.toLocaleString()} ({ad.ctrPct}%)
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          ad.active
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {ad.active ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          runPatch({
                            action: "toggle_ad",
                            adId: ad.id,
                            active: !ad.active,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200 hover:bg-white/10"
                      >
                        {ad.active ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runPatch({ action: "delete_ad", adId: ad.id })}
                        className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-rose-300 hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE BANTER MODERATION */}
      {tab === "moderation" && (
        <div className="space-y-5">
          {mutes.length > 0 && (
            <div className="rounded-2xl border border-rose-500/25 bg-[#0b0e17] p-4">
              <h3 className="text-xs font-bold text-rose-300 mb-2">
                Muted Players ({mutes.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {mutes.map((m) => (
                  <div
                    key={m.userId}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#07090e] px-3 py-1.5 text-xs"
                  >
                    <span className="font-bold text-white">{m.username}</span>
                    <button
                      type="button"
                      onClick={() =>
                        runPatch({ action: "unmute_user", userId: m.userId })
                      }
                      className="text-emerald-400 hover:underline font-semibold"
                    >
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0b0e17]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] text-slate-400">
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-white/[0.04] last:border-b-0 text-slate-200"
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">{m.username}</span>{" "}
                      <span className="text-slate-400">({m.state})</span>
                      {m.rank && (
                        <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                          #{m.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {m.room === "live_arena" ? "Live Chat" : "Thread Reply"}
                    </td>
                    <td className="px-4 py-3 max-w-md">{m.body}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          m.status === "visible"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          runPatch({
                            action: "set_message_status",
                            messageId: m.id,
                            status: m.status === "visible" ? "hidden" : "visible",
                          })
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200 hover:bg-white/10"
                      >
                        {m.status === "visible" ? "Hide" : "Restore"}
                      </button>
                      {m.userId && !m.isSystem && (
                        <button
                          type="button"
                          onClick={() =>
                            runPatch({
                              action: m.isUserMuted ? "unmute_user" : "mute_user",
                              userId: m.userId,
                            })
                          }
                          className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-rose-300 hover:bg-rose-500/20"
                        >
                          {m.isUserMuted ? "Unmute" : "Mute player"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
