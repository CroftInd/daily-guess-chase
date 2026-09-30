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

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { data, error } = await adminClient().from("challenges")
      .select("id,title,video_path,poster_path,name_answer,age_answer,occupation_answer,from_answer,is_published,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ challenges: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not load challenge archive." }, { status: 500 });
  }
}
