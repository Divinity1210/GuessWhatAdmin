import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const BUCKET_NAME = "question-media";

async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets ?? []).some((b) => b.name === BUCKET_NAME || b.id === BUCKET_NAME);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    await ensureBucket(supabase);

    const contentTypeHeader = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";
    let originalName = "upload.jpg";
    let optionId: string | null = null;
    let questionId: string | null = null;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      optionId = (formData.get("optionId") as string) || null;
      questionId = (formData.get("questionId") as string) || null;

      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No image file provided" }, { status: 400 });
      }

      mimeType = file.type || "image/jpeg";
      originalName = file.name || "option-image.jpg";
      const arrayBuf = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } else {
      const body = await req.json();
      const { dataUrl, fileName, optionId: bodyOptId, questionId: bodyQId } = body;
      optionId = bodyOptId || null;
      questionId = bodyQId || null;
      originalName = fileName || "option-image.jpg";

      if (!dataUrl || typeof dataUrl !== "string") {
        return NextResponse.json({ error: "No image data provided" }, { status: 400 });
      }

      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json({ error: "Invalid image data format" }, { status: 400 });
      }
      mimeType = match[1];
      fileBuffer = Buffer.from(match[2], "base64");
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: "Empty image file" }, { status: 400 });
    }

    const ext =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
        ? "gif"
        : mimeType === "image/avif"
        ? "avif"
        : "jpg";

    const safeBase = originalName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .toLowerCase()
      .slice(0, 40);

    const storagePath = `options/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeBase || "img"}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
    const publicUrl = pubData.publicUrl;

    // If optionId is provided, immediately persist media_url to question_options
    if (optionId) {
      await supabase
        .from("question_options")
        .update({ media_url: publicUrl })
        .eq("id", optionId);
    }

    // If questionId is provided, ensure the question type is set to 'image'
    if (questionId) {
      await supabase
        .from("questions")
        .update({ type: "image", updated_at: new Date().toISOString() })
        .eq("id", questionId);
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path: storagePath,
      optionId,
      questionId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload image" },
      { status: 500 }
    );
  }
}
