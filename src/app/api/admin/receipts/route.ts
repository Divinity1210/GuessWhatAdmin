import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const RECEIPTS_SETTING_KEY = "payout_receipts";
const BUCKET_NAME = "question-media";
const PLAYER_APP_ORIGIN =
  process.env.NEXT_PUBLIC_PLAYER_APP_URL || "https://guesswhat-tan.vercel.app";

export type PayoutReceipt = {
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

function maskAccountNumber(raw: string): string {
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

function generateReceiptId(): string {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GW-PAY-${ymd}-${rand}`;
}

async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets ?? []).some(
    (b) => b.name === BUCKET_NAME || b.id === BUCKET_NAME,
  );
  if (!exists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
  }
}

async function readReceipts(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<PayoutReceipt[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", RECEIPTS_SETTING_KEY)
    .maybeSingle();

  const val = data?.value as { receipts?: PayoutReceipt[] } | PayoutReceipt[] | null;
  if (Array.isArray(val)) return val;
  if (val && Array.isArray(val.receipts)) return val.receipts;
  return [];
}

async function saveReceipts(
  supabase: ReturnType<typeof createServiceClient>,
  receipts: PayoutReceipt[],
) {
  await supabase.from("app_settings").upsert({
    key: RECEIPTS_SETTING_KEY,
    value: { receipts: receipts.slice(0, 250) },
    updated_at: new Date().toISOString(),
  });
}

async function sendReceiptToInbox(
  supabase: ReturnType<typeof createServiceClient>,
  receipt: PayoutReceipt,
) {
  if (!receipt.userId) return false;
  const rankLabel = receipt.position ? `${formatOrdinal(receipt.position)} Place` : "Winner";
  const bodyLines = [
    `Congratulations @${receipt.username}! Your ${rankLabel} payout of ₦${receipt.amount.toLocaleString()} for ${receipt.sessionName} has been paid to ${receipt.bankName} (${receipt.accountNumberMasked}).`,
    receipt.note ? receipt.note : "",
    `Receipt ID: ${receipt.id}`,
  ].filter(Boolean);

  const { error } = await supabase.from("notifications").insert({
    user_id: receipt.userId,
    title: `Verified Payout Receipt: ₦${receipt.amount.toLocaleString()} Paid!`,
    body: bodyLines.join(" "),
    read: false,
    created_at: new Date().toISOString(),
  });
  return !error;
}

async function postReceiptToCommunity(
  supabase: ReturnType<typeof createServiceClient>,
  receipt: PayoutReceipt,
  pinInCommunity: boolean,
): Promise<string | null> {
  const rankLabel = receipt.position
    ? `${formatOrdinal(receipt.position)} Place`
    : receipt.payoutType === "referral_prize"
      ? "Referral Cash Winner"
      : "Cash Winner";

  const title = `Verified Payout: @${receipt.username} just got paid ₦${receipt.amount.toLocaleString()}!`;
  const parts = [
    `Congratulations to @${receipt.username} (${receipt.state}) for winning ${rankLabel} in ${receipt.sessionName} and receiving ₦${receipt.amount.toLocaleString()} via ${receipt.bankName} (${receipt.accountNumberMasked}).`,
    receipt.note ? receipt.note : "",
    `Receipt #${receipt.id} · GuessWhat pays real cash!`,
  ].filter(Boolean);

  const { data: inserted, error } = await supabase
    .from("community_posts")
    .insert({
      session_id: receipt.sessionId || null,
      author_id: null,
      kind: "topic",
      category: "Verified Payouts",
      title,
      body: parts.join(" "),
      status: "published",
      is_pinned: pinInCommunity,
      sponsor_name: null,
      sponsor_cta_label: "View Verified Receipt",
      sponsor_cta_url: `/receipt/${receipt.id}`,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    console.error("Failed to post receipt to community:", error?.message);
    return null;
  }
  return String(inserted.id);
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const receipts = await readReceipts(supabase);
    return NextResponse.json({ ok: true, receipts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load receipts" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const username = String(body.username || "").replace(/^@/, "").trim();
    const amount = Math.max(0, Math.round(Number(body.amount ?? 0)));
    const sessionName = String(body.sessionName || "GuessWhat Live Session").trim();
    const bankName = String(body.bankName || "Nigerian Bank").trim();

    if (!username || amount <= 0) {
      return NextResponse.json(
        { error: "Winner username and a valid payout amount are required." },
        { status: 400 },
      );
    }

    const receiptId =
      typeof body.id === "string" && /^GW-PAY-[A-Z0-9-]+$/i.test(body.id.trim())
        ? body.id.trim().toUpperCase()
        : generateReceiptId();

    let imageUrl: string | undefined;
    if (typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image/")) {
      const match = body.imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        try {
          await ensureBucket(supabase);
          const mimeType = match[1];
          const buffer = Buffer.from(match[2], "base64");
          const ext = mimeType.includes("webp") ? "webp" : "png";
          const storagePath = `receipts/${receiptId}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, buffer, {
              contentType: mimeType,
              upsert: true,
              cacheControl: "31536000",
            });
          if (!uploadErr) {
            const { data: pubData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(storagePath);
            imageUrl = pubData.publicUrl;
          }
        } catch (uploadErr) {
          console.error("Receipt PNG upload warning:", uploadErr);
        }
      }
    }

    const payoutType: PayoutReceipt["payoutType"] =
      body.payoutType === "referral_prize"
        ? "referral_prize"
        : body.payoutType === "bonus"
          ? "bonus"
          : "session_winner";

    const receipt: PayoutReceipt = {
      id: receiptId,
      sessionId: body.sessionId ? String(body.sessionId) : undefined,
      sessionName,
      payoutType,
      userId: body.userId ? String(body.userId) : undefined,
      username,
      fullName: String(body.fullName || username).trim(),
      hideFullName: Boolean(body.hideFullName),
      state: String(body.state || "Nigeria").trim(),
      position: body.position ? Number(body.position) : undefined,
      points: body.points !== undefined && body.points !== "" ? Number(body.points) : undefined,
      amount,
      bankName,
      accountNumberMasked: maskAccountNumber(String(body.accountNumber || body.accountNumberMasked || "")),
      transferRef: body.transferRef ? String(body.transferRef).trim().slice(0, 80) : undefined,
      note: body.note ? String(body.note).trim().slice(0, 280) : undefined,
      paidAt: body.paidAt ? new Date(body.paidAt).toISOString() : new Date().toISOString(),
      imageUrl,
      sharedToInbox: false,
      sharedToCommunity: false,
      createdAt: new Date().toISOString(),
    };

    // Optional: mark winner as Paid for the session
    if (body.markAsPaid && receipt.sessionId && receipt.userId) {
      const statusKey = `payout_status_${receipt.sessionId}`;
      const { data: existingStatus } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", statusKey)
        .maybeSingle();

      const statuses = {
        ...(((existingStatus?.value as { statuses?: Record<string, string> })?.statuses ??
          (existingStatus?.value as Record<string, string>) ??
          {}) as Record<string, string>),
      };
      statuses[receipt.userId] = "Paid";
      await supabase.from("app_settings").upsert({
        key: statusKey,
        value: { statuses },
        updated_at: new Date().toISOString(),
      });
    }

    if (body.shareToInbox && receipt.userId) {
      receipt.sharedToInbox = await sendReceiptToInbox(supabase, receipt);
    }

    if (body.shareToCommunity) {
      const postId = await postReceiptToCommunity(
        supabase,
        receipt,
        Boolean(body.pinInCommunity),
      );
      if (postId) {
        receipt.sharedToCommunity = true;
        receipt.communityPostId = postId;
      }
    }

    const existing = await readReceipts(supabase);
    const updated = [receipt, ...existing.filter((r) => r.id !== receipt.id)];
    await saveReceipts(supabase, updated);

    const shareUrl = `${PLAYER_APP_ORIGIN.replace(/\/$/, "")}/receipt/${receipt.id}`;
    return NextResponse.json({ ok: true, receipt, shareUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate receipt" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const receiptId = String(body.receiptId || "").trim();
    const action = String(body.action || "").trim();

    if (!receiptId || !action) {
      return NextResponse.json(
        { error: "receiptId and action are required" },
        { status: 400 },
      );
    }

    const receipts = await readReceipts(supabase);
    const idx = receipts.findIndex((r) => r.id === receiptId);
    if (idx === -1) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const target = { ...receipts[idx] };

    if (action === "share_inbox") {
      if (!target.userId) {
        return NextResponse.json(
          { error: "This custom receipt is not linked to a registered user ID." },
          { status: 400 },
        );
      }
      const sent = await sendReceiptToInbox(supabase, target);
      target.sharedToInbox = target.sharedToInbox || sent;
    } else if (action === "share_community") {
      const postId = await postReceiptToCommunity(
        supabase,
        target,
        Boolean(body.pinInCommunity),
      );
      if (postId) {
        target.sharedToCommunity = true;
        target.communityPostId = postId;
      }
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    receipts[idx] = target;
    await saveReceipts(supabase, receipts);

    return NextResponse.json({ ok: true, receipt: target });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update receipt" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    let receiptId = searchParams.get("id") || "";
    if (!receiptId) {
      const body = await req.json().catch(() => ({}));
      receiptId = String(body.id || "");
    }
    if (!receiptId) {
      return NextResponse.json({ error: "Receipt id is required" }, { status: 400 });
    }

    const receipts = await readReceipts(supabase);
    const found = receipts.find((r) => r.id === receiptId);
    const remaining = receipts.filter((r) => r.id !== receiptId);

    if (found?.communityPostId) {
      await supabase
        .from("community_posts")
        .delete()
        .eq("id", found.communityPostId);
    }

    await saveReceipts(supabase, remaining);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete receipt" },
      { status: 500 },
    );
  }
}
