import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { isCorrect } from "@/lib/scoring";

const labels: Record<string, string> = {
  name: "Name",
  age: "Age",
  occupation: "Occupation",
  from: "Where they're from",
};

export async function POST(req: Request) {
  try {
    const b = await req.json();

    const {
      challengeId,
      date,
      answers,
      displayName,
      clueUsage,
      elapsedSeconds,
    } = b;

    const player = String(displayName || "")
      .trim()
      .slice(0, 40);

    if (
      !challengeId ||
      !date ||
      !player ||
      !answers?.name ||
      !answers?.age ||
      !answers?.occupation ||
      !answers?.from
    ) {
      return NextResponse.json(
        {
          error: "Player name and all four answers are required.",
        },
        { status: 400 }
      );
    }

    const db = adminClient();

    const { data: assignment, error: ae } = await db
      .from("daily_challenges")
      .select("challenge_id")
      .eq("challenge_date", date)
      .eq("challenge_id", challengeId)
      .maybeSingle();

    if (ae || !assignment) {
      return NextResponse.json(
        { error: "Challenge unavailable." },
        { status: 404 }
      );
    }

    const { data: c, error } = await db
      .from("challenges")
      .select(
        "id,name_answer,age_answer,occupation_answer,from_answer,clues"
      )
      .eq("id", challengeId)
      .eq("is_published", true)
      .single();

    if (error || !c) {
      return NextResponse.json(
        { error: "Challenge unavailable." },
        { status: 404 }
      );
    }

    let score = 0;

    const breakdown = (
      ["name", "age", "occupation", "from"] as const
    ).map((k) => {
      const correct = isCorrect(
        k,
        String(answers[k]),
        String((c as any)[`${k}_answer`])
      );

      if (correct) {
        score++;
      }

      return {
        key: k,
        label: labels[k],
        guess: String(answers[k]),
        correctAnswer: String((c as any)[`${k}_answer`]),
        correct,
      };
    });

    // A player may answer the same archived challenge again on a later day.
    // The duplicate check is scoped to BOTH challenge and daily date.
    const safePlayerPattern = player
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");

    const { data: existing } = await db
      .from("submissions")
      .select(
        "id,score,answers,clue_usage,clue_count,elapsed_seconds"
      )
      .eq("challenge_id", challengeId)
      .eq("challenge_date", date)
      .ilike("display_name", safePlayerPattern)
      .maybeSingle();

    if (existing) {
      const existingBreakdown = (
        ["name", "age", "occupation", "from"] as const
      ).map((k) => {
        const a = existing.answers?.[k] || {};
        const correctAnswer = String(
          (c as any)[`${k}_answer`]
        );

        return {
          key: k,
          label: labels[k],
          guess: String(a.guess ?? ""),
          correctAnswer,
          correct: Boolean(a.correct),
        };
      });

      return NextResponse.json({
        score: Number(existing.score) || 0,
        clueCount: Number(existing.clue_count) || 0,
        breakdown: existingBreakdown,
        alreadySubmitted: true,
      });
    }

    const safeElapsed = Math.min(
      86400,
      Math.max(1, Math.round(Number(elapsedSeconds) || 0))
    );

    const storedAnswers = Object.fromEntries(
      breakdown.map((x) => [
        x.key,
        {
          guess: x.guess,
          correct: x.correct,
        },
      ])
    );

    const availableClues = (c as any).clues || {};

    const cleanClues = Object.fromEntries(
      (
        Object.entries(clueUsage || {}) as [
          string,
          unknown
        ][]
      )
        .filter(
          ([k, v]) =>
            ["name", "age", "occupation", "from"].includes(k) &&
            Boolean(availableClues[k]) &&
            Boolean(v)
        )
        .map(([k]) => [k, true])
    );

    const clueCount =
      Object.values(cleanClues).filter(Boolean).length;

    const { error: se } = await db
      .from("submissions")
      .insert({
        challenge_id: challengeId,
        challenge_date: date,
        display_name: player,
        score,
        answers: storedAnswers,
        clue_usage: cleanClues,
        clue_count: clueCount,
        elapsed_seconds: safeElapsed,
      });

    if (se) {
      console.error("Submission insert failed:", se);

      return NextResponse.json(
        {
          error:
            "Your score could not be saved. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      score,
      clueCount,
      breakdown,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { error: "Unable to submit. Please try again." },
      { status: 500 }
    );
  }
}