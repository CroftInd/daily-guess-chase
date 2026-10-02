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
      .select("id,title,video_path,poster_path,name_answer,age_answer,occupation_answer,from_answer,is_published,difficulty,clues,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const ids=(data||[]).map((x:any)=>x.id);
    const {data:usage}=ids.length?await adminClient().from("challenge_usage_stats").select("id,days_used,last_used,total_points,submissions,average_score").in("id",ids):{data:[]};
    const byId=new Map((usage||[]).map((x:any)=>[x.id,x]));
    const {data:subs}=ids.length?await adminClient().from("submissions").select("challenge_id,answers").in("challenge_id",ids):{data:[]};
    const accuracy=new Map<string,any>();
    for(const s of subs||[]){const a=s.answers||{};if(!accuracy.has(s.challenge_id))accuracy.set(s.challenge_id,{name:0,age:0,occupation:0,from:0,total:0});const q=accuracy.get(s.challenge_id);q.total++;for(const k of ["name","age","occupation","from"]){if(a[k]?.correct)q[k]++;}}
    return NextResponse.json({ challenges:(data||[]).map((x:any)=>({...x,usage:{...(byId.get(x.id)||{days_used:0,last_used:null,total_points:0,submissions:0,average_score:0}),accuracy:accuracy.get(x.id)||{name:0,age:0,occupation:0,from:0,total:0}}})) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not load challenge archive." }, { status: 500 });
  }
}
