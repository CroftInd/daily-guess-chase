import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { isCorrect } from "@/lib/scoring";

const labels: Record<string, string> = { name: "Name", age: "Age", occupation: "Occupation", from: "Where they're from" };

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const { challengeId, date, answers, attemptId } = b;
    const attempt = String(attemptId || "").trim();
    if (!challengeId || !date || !attempt || !answers?.name || !answers?.age || !answers?.occupation || !answers?.from) {
      return NextResponse.json({ error: "All four answers are required." }, { status: 400 });
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
      return { key: k, label: labels[k], guess: String(answers[k]), correctAnswer: String((c as any)[`${k}_answer`]), correct };
    });

    const { data: existing } = await db.from("submissions").select("id,score").eq("challenge_id", challengeId).eq("attempt_id", attempt).maybeSingle();
    if (existing) return NextResponse.json({ error: "This challenge has already been submitted." }, { status: 409 });

    const { error: se } = await db.from("submissions").insert({ challenge_id: challengeId, attempt_id: attempt, display_name: `__pending_${attempt}`, score });
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
