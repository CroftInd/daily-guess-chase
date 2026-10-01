import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

const MAX_VIDEO = 250 * 1024 * 1024;
const MAX_POSTER = 10 * 1024 * 1024;

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  if (!adminEmails().includes(user.email.toLowerCase())) {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { user };
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120);
  return cleaned || "upload";
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const title = String(body.title || "Who is it?").trim();
    const name = String(body.name || "").trim();
    const age = String(body.age || "").trim();
    const occupation = String(body.occupation || "").trim();
    const from = String(body.from || "").trim();
    const difficulty = ["easy","medium","hard"].includes(String(body.difficulty)) ? String(body.difficulty) : "medium";
    const videoPath = String(body.videoPath || "").trim();
    const posterPath = body.posterPath ? String(body.posterPath).trim() : null;

    if (!name || !age || !occupation || !from || !videoPath) {
      return NextResponse.json({ error: "Missing required challenge data." }, { status: 400 });
    }

    const db = adminClient();
    const normalize=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const {data:existing}=await db.from("challenges").select("id,title,name_answer,age_answer,occupation_answer,from_answer");
    const duplicate=(existing||[]).find((x:any)=>normalize(x.title)===normalize(title)&&normalize(x.name_answer)===normalize(name)&&normalize(x.age_answer)===normalize(age)&&normalize(x.occupation_answer)===normalize(occupation)&&normalize(x.from_answer)===normalize(from));
    if(duplicate) return NextResponse.json({error:"A very similar challenge is already in the archive.",duplicateId:duplicate.id},{status:409});
    const { data, error } = await db.from("challenges").insert({
      challenge_date: null,
      challenge_number: null,
      title,
      video_path: videoPath,
      poster_path: posterPath,
      name_answer: name,
      age_answer: age,
      occupation_answer: occupation,
      from_answer: from,
      difficulty,
      is_published: true,
      created_by: auth.user.id,
    }).select("id").single();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    console.error("publish finalize error", e);
    return NextResponse.json({ error: e?.message || "Publish failed." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const videoName = String(body.videoName || "video.mp4");
    const videoSize = Number(body.videoSize || 0);
    const videoType = String(body.videoType || "video/mp4");
    const posterName = body.posterName ? String(body.posterName) : "";
    const posterSize = Number(body.posterSize || 0);
    const posterType = String(body.posterType || "image/jpeg");

    if (!videoSize && !posterSize) {
      return NextResponse.json({ error: "A video or poster is required." }, { status: 400 });
    }
    if (videoSize > MAX_VIDEO) {
      return NextResponse.json({ error: "Video is too large. Maximum is 250MB." }, { status: 413 });
    }
    if (posterSize > MAX_POSTER) {
      return NextResponse.json({ error: "Poster is too large. Maximum is 10MB." }, { status: 413 });
    }

    const db = adminClient();
    const archiveId = body.challengeId ? String(body.challengeId) : crypto.randomUUID();
    let videoUpload: { path: string; token: string } | null = null;
    if (videoSize > 0) {
      const videoPath = `archive/${archiveId}/${crypto.randomUUID()}-${safeFilename(videoName)}`;
      const { data, error } = await db.storage.from("challenge-media").createSignedUploadUrl(videoPath);
      if (error) throw error;
      videoUpload = data;
    }

    let posterUpload: { path: string; token: string } | null = null;
    if (posterSize > 0 && posterName) {
      const posterPath = `archive/${archiveId}/${crypto.randomUUID()}-${safeFilename(posterName)}`;
      const { data, error } = await db.storage
        .from("challenge-media")
        .createSignedUploadUrl(posterPath);
      if (error) throw error;
      posterUpload = data;
    }

    return NextResponse.json({
      ok: true,
      video: videoUpload ? { path: videoUpload.path, token: videoUpload.token, contentType: videoType } : null,
      poster: posterUpload ? { path: posterUpload.path, token: posterUpload.token, contentType: posterType } : null,
    });
  } catch (e: any) {
    console.error("upload-url error", e);
    return NextResponse.json({ error: e?.message || "Could not prepare upload." }, { status: 500 });
  }
}
