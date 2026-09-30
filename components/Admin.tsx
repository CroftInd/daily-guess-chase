"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UploadTarget = { path: string; token: string; contentType: string };

export default function Admin({ email }: { email: string }) {
  const [d, setD] = useState(new Date().toISOString().slice(0, 10));
  const [challengeNumber, setChallengeNumber] = useState(1);
  const [title, setTitle] = useState("Who is it?");
  const [a, setA] = useState({ name: "", age: "", occupation: "", from: "" });
  const [video, setVideo] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (!video || Object.values(a).some((v) => !v.trim())) {
      setMsg("Please provide the video and all four answers.");
      return;
    }

    setBusy(true);
    setMsg("Preparing upload…");

    try {
      const prepare = await fetch("/api/admin/publish", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: d,
          challengeNumber,
          videoName: video.name,
          videoSize: video.size,
          videoType: video.type || "video/mp4",
          posterName: poster?.name || "",
          posterSize: poster?.size || 0,
          posterType: poster?.type || "image/jpeg",
        }),
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Could not prepare upload.");

      const supabase = createClient();
      const videoTarget = prepared.video as UploadTarget;
      const posterTarget = prepared.poster as UploadTarget | null;

      setMsg("Uploading video…");
      const videoResult = await supabase.storage
        .from("challenge-media")
        .uploadToSignedUrl(videoTarget.path, videoTarget.token, video);
      if (videoResult.error) throw videoResult.error;

      let posterPath: string | null = null;
      if (poster && posterTarget) {
        setMsg("Uploading poster…");
        const posterResult = await supabase.storage
          .from("challenge-media")
          .uploadToSignedUrl(posterTarget.path, posterTarget.token, poster);
        if (posterResult.error) throw posterResult.error;
        posterPath = posterTarget.path;
      }

      setMsg("Publishing challenge…");
      const finalize = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: d,
          challengeNumber,
          title,
          name: a.name,
          age: a.age,
          occupation: a.occupation,
          from: a.from,
          videoPath: videoTarget.path,
          posterPath,
        }),
      });
      const result = await finalize.json();
      if (!finalize.ok) throw new Error(result.error || "Publish failed.");

      setMsg("Challenge published successfully.");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message || "Publish failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    location.href = "/admin/login";
  }

  return (
    <section className="card">
      <span className="pill">ADMIN</span>
      <span className="muted small"> {email}</span>
      <button className="btn secondary" style={{ float: "right" }} onClick={logout} disabled={busy}>Sign out</button>
      <h1>Daily challenge</h1>
      <div className="notice">Publish each slot from 1–4 for the same date. Players complete all four challenges for a maximum of 16 points.</div>

      <div className="questions">
        <div className="field"><label>Date</label><input type="date" value={d} onChange={(e) => setD(e.target.value)} disabled={busy} /></div>
        <div className="field"><label>Challenge number (1–4)</label><select value={challengeNumber} onChange={(e) => setChallengeNumber(Number(e.target.value))} disabled={busy}><option value={1}>Challenge 1</option><option value={2}>Challenge 2</option><option value={3}>Challenge 3</option><option value={4}>Challenge 4</option></select></div>
        <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} /></div>
        {[['name', 'Name'], ['age', 'Age'], ['occupation', 'Occupation'], ['from', "Where they're from"]].map(([k, l]) => (
          <div className="field" key={k}>
            <label>{l}</label>
            <input value={(a as any)[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} disabled={busy} />
          </div>
        ))}
      </div>

      <div className="questions">
        <div className="field">
          <label>Video</label>
          <input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} disabled={busy} />
          <span className="muted small">Uploaded directly to storage — large videos no longer pass through the website server.</span>
        </div>
        <div className="field">
          <label>First-frame poster</label>
          <input type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] || null)} disabled={busy} />
        </div>
      </div>

      {msg && <div className={msg.includes("successfully") ? "success" : msg.includes("…") ? "notice" : "error"} style={{ marginTop: 15 }}>{msg}</div>}
      <button className="btn full" onClick={save} disabled={busy}>{busy ? "Publishing…" : "Publish challenge"}</button>
    </section>
  );
}
