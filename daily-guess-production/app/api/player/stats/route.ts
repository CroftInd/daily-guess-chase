import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

const clean=(s:string)=>s.trim().slice(0,40);
const norm=(s:string)=>s.toLowerCase().trim();

export async function GET(req:Request){
  const name=clean(new URL(req.url).searchParams.get("name")||"");
  if(!name) return NextResponse.json({error:"Player name is required."},{status:400});
  const db=adminClient();
  const {data:subs,error}=await db.from("submissions").select("challenge_id,challenge_date,display_name,score,answers,confidence,elapsed_seconds,submitted_at").ilike("display_name",name).order("challenge_date",{ascending:false}).order("submitted_at",{ascending:false});
  if(error) return NextResponse.json({error:error.message},{status:500});
  const byDay=new Map<string,any>();
  for(const s of subs||[]){
    const d=s.challenge_date||new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date(s.submitted_at));
    if(!byDay.has(d)) byDay.set(d,{date:d,score:0,completed:0,elapsed:0,submissions:[]});
    const x=byDay.get(d); x.score+=Number(s.score)||0; x.completed++; x.elapsed+=Number(s.elapsed_seconds)||0; x.submissions.push(s);
  }
  const days=[...byDay.values()].sort((a,b)=>b.date.localeCompare(a.date));
  const totalCorrect=days.reduce((n,d)=>n+d.score,0), totalQuestions=days.reduce((n,d)=>n+d.completed*4,0);
  let streak=0;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London"}).format(new Date());
  const dates=new Set(days.filter(d=>d.completed===4).map(d=>d.date));
  let cursor=new Date(`${today}T12:00:00Z`);
  if(!dates.has(today)) cursor.setUTCDate(cursor.getUTCDate()-1);
  while(dates.has(cursor.toISOString().slice(0,10))){streak++;cursor.setUTCDate(cursor.getUTCDate()-1);}
  const best=days.reduce((m,d)=>Math.max(m,d.score),0);
  const avg=days.length?days.reduce((n,d)=>n+d.score,0)/days.length:0;
  const achievements=[];
  if(best>=16) achievements.push({id:"perfect",name:"Perfect Day",icon:"🏆",desc:"Score 16/16 in a day."});
  if(streak>=7) achievements.push({id:"week",name:"Week Warrior",icon:"🔥",desc:"Complete seven consecutive days."});
  if(totalCorrect>=100) achievements.push({id:"century",name:"Century Club",icon:"💯",desc:"Reach 100 correct answers."});
  if(totalQuestions>=10) achievements.push({id:"accuracy",name:"Dead Accurate",icon:"🎯",desc:"Build a large bank of answers."});
  if(days.some(d=>d.completed===4&&d.elapsed<=120)) achievements.push({id:"speed",name:"Speed Demon",icon:"⚡",desc:"Complete a day in two minutes or less."});
  return NextResponse.json({playerName:name,days,totalCorrect,totalQuestions,average:avg,currentStreak:streak,best,fastest,achievements});
}
