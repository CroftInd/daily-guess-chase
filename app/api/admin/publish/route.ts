import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
const MAX_VIDEO=250*1024*1024,MAX_POSTER=10*1024*1024;
export async function POST(req:Request){try{
 const s=await createClient();const {data:{user}}=await s.auth.getUser();
 if(!user?.email)return NextResponse.json({error:"Not authenticated."},{status:401});
 const admins=(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!admins.includes(user.email.toLowerCase()))return NextResponse.json({error:"Admin access required."},{status:403});
 const f=await req.formData();const date=String(f.get("date")||""),title=String(f.get("title")||"Who is it?"),name=String(f.get("name")||""),age=String(f.get("age")||""),occupation=String(f.get("occupation")||""),from=String(f.get("from")||"");
 const video=f.get("video"),poster=f.get("poster");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!name||!age||!occupation||!from||!(video instanceof File))return NextResponse.json({error:"Missing required challenge data."},{status:400});
 if(video.size>MAX_VIDEO)return NextResponse.json({error:"Video is too large. Maximum is 250MB."},{status:413});
 if(poster instanceof File&&poster.size>MAX_POSTER)return NextResponse.json({error:"Poster is too large. Maximum is 10MB."},{status:413});
 const db=adminClient(),safe=(x:string)=>x.replace(/[^a-zA-Z0-9._-]/g,"");const vp=`${date}/${crypto.randomUUID()}-${safe(video.name)}`;
 let r=await db.storage.from("challenge-media").upload(vp,video,{upsert:true,contentType:video.type||"video/mp4"});if(r.error)throw r.error;
 let pp:string|null=null;if(poster instanceof File){pp=`${date}/${crypto.randomUUID()}-${safe(poster.name)}`;r=await db.storage.from("challenge-media").upload(pp,poster,{upsert:true,contentType:poster.type||"image/jpeg"});if(r.error)throw r.error;}
 const {error}=await db.from("challenges").upsert({challenge_date:date,title,video_path:vp,poster_path:pp,name_answer:name,age_answer:age,occupation_answer:occupation,from_answer:from,is_published:true,created_by:user.id},{onConflict:"challenge_date"});if(error)throw error;
 return NextResponse.json({ok:true});
}catch(e:any){console.error(e);return NextResponse.json({error:e.message||"Publish failed."},{status:500});}}
