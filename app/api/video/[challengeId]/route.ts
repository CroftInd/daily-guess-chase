import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(req: Request, { params }: { params: Promise<{ challengeId: string }> }) {
  try {
    const { challengeId } = await params;
    const url = new URL(req.url);
    const date = url.searchParams.get("date") || "";
    const displayName = (url.searchParams.get("displayName") || "").trim().slice(0, 40);

    if (!challengeId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !displayName) {
      return NextResponse.json({ error: "Video unavailable." }, { status: 400 });
    }

    const db = adminClient();
    const { data: assignment } = await db
      .from("daily_challenges")
      .select("challenge_id")
      .eq("challenge_date", date)
      .eq("challenge_id", challengeId)
      .maybeSingle();
    if (!assignment) return NextResponse.json({ error: "Video unavailable." }, { status: 404 });

    const { data: submission } = await db
      .from("submissions")
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("display_name", displayName)
      .maybeSingle();
    if (!submission) return NextResponse.json({ error: "Submit your guesses first." }, { status: 403 });

    const { data: challenge, error } = await db
      .from("challenges")
      .select("video_path")
      .eq("id", challengeId)
      .eq("is_published", true)
      .single();
    if (error || !challenge?.video_path) return NextResponse.json({ error: "Video unavailable." }, { status: 404 });

    const { data: signed, error: signError } = await db.storage
      .from("challenge-media")
      .createSignedUrl(challenge.video_path, 60 * 60 * 4);
    if (signError || !signed?.signedUrl) return NextResponse.json({ error: "Unable to load video." }, { status: 500 });

    return NextResponse.json({ videoUrl: signed.signedUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unable to load video." }, { status: 500 });
  }
}
