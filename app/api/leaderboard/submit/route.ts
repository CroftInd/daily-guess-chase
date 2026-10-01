import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const date = String(b.date || "");
    const attemptId = String(b.attemptId || "").trim();
    const displayName = String(b.displayName || "").trim().slice(0, 40);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !attemptId || !displayName) {
      return NextResponse.json({ error: "A leaderboard name is required." }, { status: 400 });
    }

    const db = adminClient();
    const { data: assignments, error: ae } = await db
      .from("daily_challenges")
      .select("challenge_id")
      .eq("challenge_date", date);
    if (ae || !assignments?.length) return NextResponse.json({ error: "Today's challenges are unavailable." }, { status: 404 });

    const ids = assignments.map(x => x.challenge_id);
    const { data: submissions, error: se } = await db
      .from("submissions")
      .select("id,challenge_id,display_name")
      .eq("attempt_id", attemptId)
      .in("challenge_id", ids);
    if (se || !submissions || submissions.length !== ids.length) {
      return NextResponse.json({ error: "Please complete all four challenges before submitting your score." }, { status: 400 });
    }

    const { error: ue } = await db
      .from("submissions")
      .update({ display_name: displayName })
      .eq("attempt_id", attemptId)
      .in("challenge_id", ids);
    if (ue) {
      console.error("Leaderboard update failed:", ue);
      return NextResponse.json({ error: "Your leaderboard score could not be saved. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unable to submit to the leaderboard." }, { status: 500 });
  }
}
