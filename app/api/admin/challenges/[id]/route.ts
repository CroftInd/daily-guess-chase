import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  if (!adminEmails().includes(user.email.toLowerCase())) return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  return { user };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const [input, column] of [["title","title"],["name","name_answer"],["age","age_answer"],["occupation","occupation_answer"],["from","from_answer"],["videoPath","video_path"],["posterPath","poster_path"],["difficulty","difficulty"]] as const) {
      if (body[input] !== undefined) updates[column] = body[input] === null ? null : String(body[input]).trim();
    }
    if (body.clues !== undefined) updates.clues = { name:String(body.clues?.name||"").trim().slice(0,240), age:String(body.clues?.age||"").trim().slice(0,240), occupation:String(body.clues?.occupation||"").trim().slice(0,240), from:String(body.clues?.from||"").trim().slice(0,240) };
    if (body.isPublished !== undefined) updates.is_published = Boolean(body.isPublished);
    if (updates.difficulty && !["easy","medium","hard"].includes(String(updates.difficulty))) return NextResponse.json({error:"Invalid difficulty."},{status:400});
    if (Object.keys(updates).some(key => ["name_answer","age_answer","occupation_answer","from_answer","video_path"].includes(key))) {
      for (const key of ["name_answer","age_answer","occupation_answer","from_answer","video_path"]) {
        if (updates[key] !== undefined && (!updates[key] || typeof updates[key] !== "string")) return NextResponse.json({ error: "All four answers and a video are required." }, { status: 400 });
      }
    }
    const { data, error } = await adminClient().from("challenges").update(updates).eq("id", id).select("id,title,video_path,poster_path,name_answer,age_answer,occupation_answer,from_answer,is_published,difficulty,created_at").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, challenge: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not update challenge." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;
    const db = adminClient();
    const { count } = await db.from("daily_challenges").select("challenge_id", { count: "exact", head: true }).eq("challenge_id", id);
    if ((count || 0) > 0) return NextResponse.json({ error: "This challenge has already been used in a daily draw. Unpublish it instead of deleting it." }, { status: 409 });
    const { error } = await db.from("challenges").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not delete challenge." }, { status: 500 });
  }
}
