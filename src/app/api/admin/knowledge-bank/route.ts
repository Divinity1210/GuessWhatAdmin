import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const KB_SETTING_KEY = "faq_knowledge_bank";

export type KnowledgeBankEntry = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  sampleQuestions: string[];
  answer: string;
  ctaLabel?: string;
  ctaHref?: string;
  active: boolean;
  updatedAt: string;
};

async function readEntries(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<KnowledgeBankEntry[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", KB_SETTING_KEY)
    .maybeSingle();

  const val = data?.value as { entries?: KnowledgeBankEntry[] } | KnowledgeBankEntry[] | null;
  if (Array.isArray(val)) return val;
  if (val && Array.isArray(val.entries)) return val.entries;
  return [];
}

async function saveEntries(
  supabase: ReturnType<typeof createServiceClient>,
  entries: KnowledgeBankEntry[],
) {
  await supabase.from("app_settings").upsert({
    key: KB_SETTING_KEY,
    value: { entries },
    updated_at: new Date().toISOString(),
  });
}

function normalizeList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const entries = await readEntries(supabase);
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load knowledge bank" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();

    const title = String(body.title || "").trim();
    const answer = String(body.answer || "").trim();
    const category = String(body.category || "General").trim();

    if (!title || !answer) {
      return NextResponse.json(
        { error: "Title and answer are required" },
        { status: 400 },
      );
    }

    const entry: KnowledgeBankEntry = {
      id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      category,
      keywords: normalizeList(body.keywords),
      sampleQuestions: normalizeList(body.sampleQuestions),
      answer,
      ctaLabel: body.ctaLabel ? String(body.ctaLabel).trim() : undefined,
      ctaHref: body.ctaHref ? String(body.ctaHref).trim() : undefined,
      active: body.active !== false,
      updatedAt: new Date().toISOString(),
    };

    const existing = await readEntries(supabase);
    await saveEntries(supabase, [entry, ...existing]);

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create knowledge entry" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Entry id is required" }, { status: 400 });
    }

    const entries = await readEntries(supabase);
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Knowledge entry not found" }, { status: 404 });
    }

    const current = entries[idx];
    const updated: KnowledgeBankEntry = {
      ...current,
      title: body.title !== undefined ? String(body.title).trim() || current.title : current.title,
      category:
        body.category !== undefined
          ? String(body.category).trim() || current.category
          : current.category,
      keywords:
        body.keywords !== undefined ? normalizeList(body.keywords) : current.keywords,
      sampleQuestions:
        body.sampleQuestions !== undefined
          ? normalizeList(body.sampleQuestions)
          : current.sampleQuestions,
      answer:
        body.answer !== undefined ? String(body.answer).trim() || current.answer : current.answer,
      ctaLabel:
        body.ctaLabel !== undefined
          ? String(body.ctaLabel).trim() || undefined
          : current.ctaLabel,
      ctaHref:
        body.ctaHref !== undefined
          ? String(body.ctaHref).trim() || undefined
          : current.ctaHref,
      active: body.active !== undefined ? Boolean(body.active) : current.active,
      updatedAt: new Date().toISOString(),
    };

    entries[idx] = updated;
    await saveEntries(supabase, entries);

    return NextResponse.json({ ok: true, entry: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update knowledge entry" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id") || "";
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = String(body.id || "");
    }
    if (!id) {
      return NextResponse.json({ error: "Entry id is required" }, { status: 400 });
    }

    const entries = await readEntries(supabase);
    await saveEntries(
      supabase,
      entries.filter((e) => e.id !== id),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete knowledge entry" },
      { status: 500 },
    );
  }
}
