import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Game from "@/components/Game";

export default async function Day({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const s = await createClient();
  const { data, error } = await s.rpc("get_or_create_daily_challenges", { p_date: date });
  if (error) return <section className="card" style={{ marginTop: 40 }}><div className="eyebrow">DAILY GUESS</div><h1>Today&apos;s challenges aren&apos;t ready yet</h1><p className="muted">The challenge archive needs at least four published challenges before a daily set can be created.</p></section>;
  if (!data?.length) notFound();
  const challenges = data.sort((a: any, b: any) => a.slot - b.slot).map((x: any) => ({
    id: x.challenge_id,
    slot: x.slot,
    title: x.title,
    // Intentionally do NOT send the video URL to the browser before submission.
    // The client receives only the poster and fetches the video after its guesses are accepted.
    posterUrl: x.poster_path ? s.storage.from("challenge-media").getPublicUrl(x.poster_path).data.publicUrl : null,
  }));
  return <Game date={date} challenges={challenges} />;
}
