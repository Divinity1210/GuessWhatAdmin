"use client";

import { useEffect, useState } from "react";

export type PayoutReceiptRecord = {
  id: string;
  sessionId?: string;
  sessionName: string;
  payoutType: "session_winner" | "referral_prize" | "bonus";
  userId?: string;
  username: string;
  fullName: string;
  hideFullName: boolean;
  state: string;
  position?: number;
  points?: number;
  amount: number;
  bankName: string;
  accountNumberMasked: string;
  transferRef?: string;
  note?: string;
  paidAt: string;
  imageUrl?: string;
  sharedToInbox: boolean;
  sharedToCommunity: boolean;
  communityPostId?: string;
  createdAt: string;
};

export type ReceiptInitialData = {
  sessionId?: string;
  sessionName?: string;
  payoutType?: "session_winner" | "referral_prize" | "bonus";
  userId?: string;
  username?: string;
  fullName?: string;
  state?: string;
  position?: number;
  points?: number;
  amount?: number;
  bankName?: string;
  accountNumber?: string;
};

const PLAYER_APP_ORIGIN = "https://guesswhat-tan.vercel.app";

export function maskAccountNumber(raw: string): string {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length >= 4) {
    return `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
  }
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "******";
  if (trimmed.includes("*")) return trimmed;
  return `******${trimmed.slice(-4)}`;
}

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function buildReceiptId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GW-PAY-${ymd}-${rand}`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderReceiptPngDataUrl(params: {
  id: string;
  username: string;
  fullName: string;
  hideFullName: boolean;
  state: string;
  position?: number;
  points?: number;
  sessionName: string;
  payoutType: "session_winner" | "referral_prize" | "bonus";
  amount: number;
  bankName: string;
  accountNumberMasked: string;
  transferRef?: string;
  note?: string;
  paidAt: string;
}): string {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const fontSans = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const fontMono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b101d");
  bg.addColorStop(0.5, "#080b14");
  bg.addColorStop(1, "#06080f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top-right warm orange glow
  const glow1 = ctx.createRadialGradient(W - 140, 120, 10, W - 140, 120, 420);
  glow1.addColorStop(0, "rgba(247, 145, 27, 0.22)");
  glow1.addColorStop(1, "rgba(247, 145, 27, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  // Bottom-left emerald glow
  const glow2 = ctx.createRadialGradient(160, H - 160, 10, 160, H - 160, 420);
  glow2.addColorStop(0, "rgba(16, 185, 129, 0.16)");
  glow2.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Outer Card Frame
  drawRoundedRect(ctx, 48, 48, W - 96, H - 96, 40);
  ctx.fillStyle = "rgba(15, 20, 34, 0.92)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.stroke();

  // Brand Emblem
  drawRoundedRect(ctx, 96, 98, 76, 76, 20);
  const logoGrad = ctx.createLinearGradient(96, 98, 172, 174);
  logoGrad.addColorStop(0, "#FF2E00");
  logoGrad.addColorStop(1, "#F7911B");
  ctx.fillStyle = logoGrad;
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 32px ${fontSans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GW", 134, 138);

  // Brand text
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 36px ${fontSans}`;
  ctx.fillText("GuessWhat", 192, 126);
  ctx.fillStyle = "#94A3B8";
  ctx.font = `600 20px ${fontSans}`;
  ctx.fillText("OFFICIAL PAYOUT RECEIPT", 192, 160);

  // Verified Badge (top right)
  drawRoundedRect(ctx, W - 360, 108, 264, 54, 27);
  ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(52, 211, 153, 0.5)";
  ctx.stroke();

  ctx.fillStyle = "#34D399";
  ctx.font = `800 20px ${fontSans}`;
  ctx.textAlign = "center";
  ctx.fillText("✓ VERIFIED PAID", W - 228, 136);

  // Hero Amount Box
  drawRoundedRect(ctx, 96, 218, W - 192, 240, 32);
  const heroGrad = ctx.createLinearGradient(96, 218, W - 96, 458);
  heroGrad.addColorStop(0, "rgba(247, 145, 27, 0.2)");
  heroGrad.addColorStop(0.55, "rgba(236, 88, 18, 0.14)");
  heroGrad.addColorStop(1, "rgba(16, 185, 129, 0.14)");
  ctx.fillStyle = heroGrad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(247, 145, 27, 0.42)";
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#FDBA74";
  ctx.font = `700 22px ${fontSans}`;
  ctx.fillText("CASH PRIZE PAID", W / 2, 268);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 84px ${fontSans}`;
  ctx.fillText(`₦${params.amount.toLocaleString()}`, W / 2, 348);

  ctx.fillStyle = "#6EE7B7";
  ctx.font = `700 22px ${fontSans}`;
  const awardSub =
    params.position && params.position > 0
      ? `${formatOrdinal(params.position)} Place · ${params.sessionName}`
      : params.payoutType === "referral_prize"
        ? `Referral Cash Prize · ${params.sessionName}`
        : params.sessionName;
  ctx.fillText(awardSub.slice(0, 56), W / 2, 418);

  // Details Card
  drawRoundedRect(ctx, 96, 494, W - 192, 540, 28);
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.stroke();

  const winnerDisplay = params.hideFullName
    ? `@${params.username} (${params.state})`
    : `@${params.username} · ${params.fullName}`;

  const paidDateText = new Date(params.paidAt).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows: { label: string; value: string; mono?: boolean; accent?: string }[] = [
    { label: "WINNER", value: winnerDisplay.slice(0, 40), accent: "#FFFFFF" },
    { label: "STATE / LOCATION", value: params.state || "Nigeria" },
    { label: "PAYOUT BANK", value: params.bankName || "Nigerian Bank" },
    {
      label: "ACCOUNT NUMBER",
      value: params.accountNumberMasked,
      mono: true,
      accent: "#FCD34D",
    },
    { label: "RECEIPT ID", value: params.id, mono: true, accent: "#34D399" },
    {
      label: params.transferRef ? "TRANSFER REF" : "DATE PAID",
      value: params.transferRef || paidDateText,
      mono: Boolean(params.transferRef),
    },
  ];

  if (params.transferRef) {
    rows.push({ label: "DATE PAID", value: paidDateText });
  } else if (params.points !== undefined) {
    rows.push({ label: "WINNING SCORE", value: `${params.points} pts`, mono: true, accent: "#FDBA74" });
  }

  let rowY = 548;
  const rowStep = rows.length >= 7 ? 72 : 82;

  rows.forEach((row, idx) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#94A3B8";
    ctx.font = `700 20px ${fontSans}`;
    ctx.fillText(row.label, 136, rowY);

    ctx.textAlign = "right";
    ctx.fillStyle = row.accent || "#F1F5F9";
    ctx.font = row.mono ? `700 24px ${fontMono}` : `700 24px ${fontSans}`;
    ctx.fillText(row.value.slice(0, 36), W - 136, rowY);

    if (idx < rows.length - 1) {
      ctx.beginPath();
      ctx.moveTo(136, rowY + rowStep / 2);
      ctx.lineTo(W - 136, rowY + rowStep / 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    rowY += rowStep;
  });

  // Optional note strip
  if (params.note?.trim()) {
    drawRoundedRect(ctx, 96, 1062, W - 192, 86, 20);
    ctx.fillStyle = "rgba(247, 145, 27, 0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(247, 145, 27, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#FDE68A";
    ctx.font = `600 21px ${fontSans}`;
    ctx.fillText(`"${params.note.trim().slice(0, 74)}"`, W / 2, 1106);
  }

  // Footer Trust Seal
  const footerY = params.note?.trim() ? 1192 : 1140;
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 24px ${fontSans}`;
  ctx.fillText("Real Players. Real Crowd. Real Cash Payouts.", W / 2, footerY);

  ctx.fillStyle = "#94A3B8";
  ctx.font = `600 20px ${fontMono}`;
  ctx.fillText(`Verify receipt: ${PLAYER_APP_ORIGIN.replace(/^https?:\/\//, "")}/receipt/${params.id}`, W / 2, footerY + 40);

  return canvas.toDataURL("image/png");
}

export function ReceiptGeneratorModal({
  open,
  onClose,
  initialData,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: ReceiptInitialData | null;
  onCreated?: (receipt: PayoutReceiptRecord) => void;
}) {
  const [receiptId, setReceiptId] = useState(buildReceiptId);
  const [payoutType, setPayoutType] = useState<"session_winner" | "referral_prize" | "bonus">(
    "session_winner",
  );
  const [sessionName, setSessionName] = useState("GuessWhat Live Session");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [hideFullName, setHideFullName] = useState(true);
  const [stateName, setStateName] = useState("Lagos");
  const [position, setPosition] = useState<string>("1");
  const [points, setPoints] = useState<string>("");
  const [amount, setAmount] = useState<string>("10000");
  const [bankName, setBankName] = useState("GTBank");
  const [accountNumber, setAccountNumber] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [note, setNote] = useState("Congrats on winning! Play free in the next live session.");

  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [shareToInbox, setShareToInbox] = useState(true);
  const [shareToCommunity, setShareToCommunity] = useState(true);
  const [pinInCommunity, setPinInCommunity] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdReceipt, setCreatedReceipt] = useState<PayoutReceiptRecord | null>(null);
  const [createdShareUrl, setCreatedShareUrl] = useState("");
  const [localPngUrl, setLocalPngUrl] = useState("");
  const [copiedType, setCopiedType] = useState<"link" | "caption" | null>(null);

  useEffect(() => {
    if (!open) return;
    setReceiptId(buildReceiptId());
    setPayoutType(initialData?.payoutType || "session_winner");
    setSessionName(initialData?.sessionName || "GuessWhat Live Session");
    setUsername(initialData?.username || "");
    setFullName(initialData?.fullName || initialData?.username || "");
    setHideFullName(true);
    setStateName(initialData?.state || "Lagos");
    setPosition(initialData?.position ? String(initialData.position) : "");
    setPoints(initialData?.points !== undefined ? String(initialData.points) : "");
    setAmount(initialData?.amount ? String(initialData.amount) : "10000");
    setBankName(initialData?.bankName || "GTBank");
    setAccountNumber(initialData?.accountNumber || "");
    setTransferRef("");
    setNote("Congrats on winning! Play free in the next live session.");
    setMarkAsPaid(Boolean(initialData?.sessionId && initialData?.userId));
    setShareToInbox(Boolean(initialData?.userId));
    setShareToCommunity(true);
    setPinInCommunity(false);
    setErrorMsg("");
    setCreatedReceipt(null);
    setCreatedShareUrl("");
    setLocalPngUrl("");
    setCopiedType(null);
  }, [open, initialData]);

  if (!open) return null;

  const numericAmount = Math.max(0, Math.round(Number(amount) || 0));
  const maskedAccount = maskAccountNumber(accountNumber);
  const cleanUser = username.replace(/^@/, "").trim() || "winner";
  const parsedPos = position ? Number(position) : undefined;
  const parsedPts = points !== "" ? Number(points) : undefined;

  const generateCurrentPng = () =>
    renderReceiptPngDataUrl({
      id: receiptId,
      username: cleanUser,
      fullName: fullName.trim() || cleanUser,
      hideFullName,
      state: stateName.trim() || "Nigeria",
      position: parsedPos,
      points: parsedPts,
      sessionName: sessionName.trim() || "GuessWhat Live Session",
      payoutType,
      amount: numericAmount,
      bankName: bankName.trim() || "Nigerian Bank",
      accountNumberMasked: maskedAccount,
      transferRef: transferRef.trim() || undefined,
      note: note.trim() || undefined,
      paidAt: new Date().toISOString(),
    });

  const handleDownloadPng = (dataUrlOverride?: string, idOverride?: string) => {
    const url = dataUrlOverride || localPngUrl || generateCurrentPng();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${idOverride || receiptId}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleGenerateAndShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || numericAmount <= 0) {
      setErrorMsg("Enter a winner username and payout amount greater than 0.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      const pngDataUrl = generateCurrentPng();
      setLocalPngUrl(pngDataUrl);

      const res = await fetch("/api/admin/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: receiptId,
          sessionId: initialData?.sessionId,
          sessionName: sessionName.trim() || "GuessWhat Live Session",
          payoutType,
          userId: initialData?.userId,
          username: cleanUser,
          fullName: fullName.trim() || cleanUser,
          hideFullName,
          state: stateName.trim() || "Nigeria",
          position: parsedPos,
          points: parsedPts,
          amount: numericAmount,
          bankName: bankName.trim() || "Nigerian Bank",
          accountNumber: accountNumber.trim(),
          transferRef: transferRef.trim() || undefined,
          note: note.trim() || undefined,
          imageDataUrl: pngDataUrl,
          markAsPaid,
          shareToInbox,
          shareToCommunity,
          pinInCommunity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate receipt");
      }

      const saved = data.receipt as PayoutReceiptRecord;
      setCreatedReceipt(saved);
      setCreatedShareUrl(
        data.shareUrl || `${PLAYER_APP_ORIGIN}/receipt/${saved.id}`,
      );
      onCreated?.(saved);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not generate receipt");
    } finally {
      setSubmitting(false);
    }
  };

  const buildPromoCaption = (r: PayoutReceiptRecord, url: string) => {
    const rankStr = r.position ? `${formatOrdinal(r.position)} Place` : "Cash Winner";
    return `VERIFIED PAYOUT ALERT!\n\n@${r.username} (${r.state}) just got paid ₦${r.amount.toLocaleString()} for winning ${rankStr} in ${r.sessionName} (${r.bankName} ${r.accountNumberMasked}).\n\nReceipt ID: ${r.id}\nVerify receipt & play free: ${url}\n\nGuessWhat pays real cash!`;
  };

  const copyText = async (text: string, kind: "link" | "caption") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-3xl bg-[#0f1219] border border-white/15 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                Shareable Payment Receipt Studio
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Proof of Payout
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate a branded verified receipt PNG, send to the winner&apos;s inbox, and publish proof to the community.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {createdReceipt ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Generated Visual Preview */}
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-[#080c16] p-2">
                  {(localPngUrl || createdReceipt.imageUrl) && (
                    <img
                      src={localPngUrl || createdReceipt.imageUrl}
                      alt={`Verified receipt ${createdReceipt.id}`}
                      className="w-full rounded-xl object-contain max-h-[460px] mx-auto"
                    />
                  )}
                </div>
              </div>

              {/* Delivery Confirmation & Share Actions */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <p className="text-sm font-extrabold text-emerald-300">
                    ✓ Receipt {createdReceipt.id} Generated &amp; Verified
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    {createdReceipt.sharedToInbox && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                        ✓ Sent to @{createdReceipt.username}&apos;s Inbox
                      </span>
                    )}
                    {createdReceipt.sharedToCommunity && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30">
                        ✓ Posted in Community Arena
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Public Verification Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={createdShareUrl}
                      className="flex-1 rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() => copyText(createdShareUrl, "link")}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs shrink-0"
                    >
                      {copiedType === "link" ? "Copied!" : "Copy Link"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    WhatsApp / X / Instagram Caption
                  </label>
                  <textarea
                    readOnly
                    rows={5}
                    value={buildPromoCaption(createdReceipt, createdShareUrl)}
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        buildPromoCaption(createdReceipt, createdShareUrl),
                        "caption",
                      )
                    }
                    className="w-full py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-bold text-white"
                  >
                    {copiedType === "caption"
                      ? "✓ Promo Caption Copied!"
                      : "Copy Social Promo Caption"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadPng(
                        localPngUrl || createdReceipt.imageUrl,
                        createdReceipt.id,
                      )
                    }
                    className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs"
                  >
                    ⬇ Download PNG Card
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleGenerateAndShare}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left: Editable Receipt Fields */}
              <div className="lg:col-span-7 space-y-3.5">
                {errorMsg && (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-500/15 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Payout Type
                    </label>
                    <select
                      value={payoutType}
                      onChange={(e) =>
                        setPayoutType(
                          e.target.value as "session_winner" | "referral_prize" | "bonus",
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    >
                      <option value="session_winner">Session Winner Prize</option>
                      <option value="referral_prize">Referral Cash Leaderboard</option>
                      <option value="bonus">Community / Promo Bonus</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Receipt ID
                    </label>
                    <input
                      value={receiptId}
                      onChange={(e) => setReceiptId(e.target.value.toUpperCase())}
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-emerald-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Winner @username *
                    </label>
                    <input
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. Ifeanyi"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Full Name (optional)
                    </label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Winner full name"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Amount Paid (₦) *
                    </label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-emerald-500/35 bg-[#07090e] px-3 py-2 text-xs font-mono font-bold text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Rank / Position
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="1"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      State
                    </label>
                    <input
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      placeholder="Lagos"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Session / Campaign Name
                  </label>
                  <input
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Bank Name
                    </label>
                    <input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="GTBank / OPay / Moniepoint"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Account No. (Auto-masked: {maskedAccount})
                    </label>
                    <input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="10-digit NUBAN"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Transfer Reference (optional)
                    </label>
                    <input
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder="e.g. NIP-202611230091"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Winning Score (optional pts)
                    </label>
                    <input
                      type="number"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      placeholder="e.g. 94"
                      className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Short Congratulatory Note (optional)
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={140}
                    className="w-full rounded-xl border border-white/10 bg-[#07090e] px-3 py-2 text-xs text-white"
                  />
                </div>

                {/* Privacy & Distribution Toggles */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5 text-xs">
                  <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideFullName}
                      onChange={(e) => setHideFullName(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Show @username only on public receipt (hide legal full name)</span>
                  </label>

                  {initialData?.sessionId && initialData?.userId && (
                    <label className="flex items-center gap-2.5 text-emerald-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={markAsPaid}
                        onChange={(e) => setMarkAsPaid(e.target.checked)}
                        className="accent-emerald-500"
                      />
                      <span>Mark this winner&apos;s payout status as Paid</span>
                    </label>
                  )}

                  {initialData?.userId && (
                    <label className="flex items-center gap-2.5 text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareToInbox}
                        onChange={(e) => setShareToInbox(e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span>Send verified receipt directly to @{cleanUser}&apos;s Inbox</span>
                    </label>
                  )}

                  <label className="flex items-center gap-2.5 text-amber-200 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareToCommunity}
                      onChange={(e) => setShareToCommunity(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Publish proof of payout to Community Arena</span>
                  </label>

                  {shareToCommunity && (
                    <label className="flex items-center gap-2.5 pl-6 text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pinInCommunity}
                        onChange={(e) => setPinInCommunity(e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span>Pin payout post at top of Community Arena</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Right: Live Branded Card Preview + Submit */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                <div className="rounded-2xl border border-white/15 bg-gradient-to-b from-[#131a2c] to-[#080c16] p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#FF2E00] to-[#F7911B] text-xs font-black text-white">
                        GW
                      </span>
                      <div>
                        <p className="text-xs font-extrabold text-white leading-none">
                          GuessWhat
                        </p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
                          Official Receipt
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-extrabold text-emerald-300">
                      ✓ VERIFIED PAID
                    </span>
                  </div>

                  <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-emerald-500/10 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                      Cash Prize Paid
                    </p>
                    <p className="text-3xl font-black text-white tabular-nums mt-1">
                      ₦{numericAmount.toLocaleString()}
                    </p>
                    <p className="text-[11px] font-semibold text-emerald-300 mt-1 truncate">
                      {parsedPos ? `${formatOrdinal(parsedPos)} Place · ` : ""}
                      {sessionName || "GuessWhat"}
                    </p>
                  </div>

                  <dl className="divide-y divide-white/[0.07] text-xs">
                    <div className="flex justify-between py-2 gap-2">
                      <dt className="text-slate-400">Winner</dt>
                      <dd className="font-bold text-white text-right truncate">
                        @{cleanUser}
                        {!hideFullName && fullName ? ` · ${fullName}` : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between py-2 gap-2">
                      <dt className="text-slate-400">Location</dt>
                      <dd className="font-semibold text-slate-200">{stateName || "Nigeria"}</dd>
                    </div>
                    <div className="flex justify-between py-2 gap-2">
                      <dt className="text-slate-400">Bank</dt>
                      <dd className="font-semibold text-slate-200">
                        {bankName || "Nigerian Bank"} ·{" "}
                        <span className="font-mono text-amber-300">{maskedAccount}</span>
                      </dd>
                    </div>
                    <div className="flex justify-between py-2 gap-2">
                      <dt className="text-slate-400">Receipt ID</dt>
                      <dd className="font-mono font-bold text-emerald-300">{receiptId}</dd>
                    </div>
                    {transferRef && (
                      <div className="flex justify-between py-2 gap-2">
                        <dt className="text-slate-400">Transfer Ref</dt>
                        <dd className="font-mono text-slate-200 truncate">{transferRef}</dd>
                      </div>
                    )}
                  </dl>

                  <p className="text-[10px] text-center text-slate-400 pt-1 border-t border-white/[0.06]">
                    Real Players. Real Crowd. Real Cash Payouts.
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors"
                  >
                    {submitting
                      ? "Generating & Publishing Receipt..."
                      : "Generate & Share Verified Receipt"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPng()}
                    className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 font-bold text-xs transition-colors"
                  >
                    ⬇ Download PNG Only (Without Posting)
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
