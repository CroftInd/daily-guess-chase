import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { isCorrect } from "@/lib/scoring";

const labels: Record<string, string> = { name: "Name", age: "Age", occupation: "Occupation", from: "Where they're from" };

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { challengeId, date, answers, displayName, confidence, elapsedSeconds } = b;
    const player = String(displayName || "").trim().slice(0, 40);
    if (!challengeId || !date || !player || !answers?.name || !answers?.age || !answers?.occupation || !answers?.from) {
      return NextResponse.json({ error: "Player name and all four answers are required." }, { status: 400 });
    }

    const db = adminClient();
    const { data: assignment, error: ae } = await db.from("daily_challenges").select("challenge_id").eq("challenge_date", date).eq("challenge_id", challengeId).maybeSingle();
    if (ae || !assignment) return NextResponse.json({ error: "Challenge unavailable." }, { status: 404 });

    const { data: c, error } = await db.from("challenges").select("id,name_answer,age_answer,occupation_answer,from_answer").eq("id", challengeId).eq("is_published", true).single();
    if (error || !c) return NextResponse.json({ error: "Challenge unavailable." }, { status: 404 });

    let score = 0;
    const breakdown = (["name", "age", "occupation", "from"] as const).map(k => {
      const correct = isCorrect(k, String(answers[k]), String((c as any)[`${k}_answer`]));
      if (correct) score++;
      return { key: k, label: labels[k], guess: String(answers[k]), correctAnswer: String((c as any)[`${k}_answer`]), correct, confidence: String(confidence?.[k]||"") };
    });

    // Prevent accidental duplicate submissions from refreshing/retries.
    const { data: existing } = await db.from("submissions").select("id,score").eq("challenge_id", challengeId).eq("challenge_date", date).ilike("display_name", player).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "This challenge has already been submitted for this leaderboard name." }, { status: 409 });
    }

    const storedAnswers=Object.fromEntries(breakdown.map(x=>[x.key,{guess:x.guess,correct:x.correct}]));
    const { error: se } = await db.from("submissions").insert({ challenge_id: challengeId, challenge_date: date, display_name: player, score, answers:storedAnswers, confidence: confidence || {}, elapsed_seconds: Math.max(0, Math.round(Number(elapsedSeconds)||0)) });
    if (se) {
      console.error("Submission insert failed:", se);
      return NextResponse.json({ error: "Your score could not be saved. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ score, breakdown });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Unable to submit. Please try again." }, { status: 500 });
  }
}
