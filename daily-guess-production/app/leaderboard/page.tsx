import {adminClient} from "@/lib/supabase/admin";
import LeaderboardClient from "@/components/LeaderboardClient";
export const dynamic="force-dynamic"; export const revalidate=0;
function uk(d=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function prevDate(date:string){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
async function aggregate(db:any,dates?:string[]){
 let q=db.from("submissions").select("display_name,score,submitted_at,challenge_id,challenge_date,elapsed_seconds");
 if(dates) q=q.in("challenge_date",dates); const {data,error}=await q.order("submitted_at",{ascending:true}); if(error)return [];
 const map=new Map<string,any>();
 for(const x of data||[]){const key=x.display_name.trim().toLowerCase(); if(!map.has(key))map.set(key,{key,name:x.display_name.trim(),score:0,completed:new Set<string>(),elapsed:0,days:new Set<string>(),best:0}); const r=map.get(key); if(!r.completed.has(`${x.challenge_date}:${x.challenge_id}`)){r.completed.add(`${x.challenge_date}:${x.challenge_id}`);r.score+=Number(x.score)||0;r.elapsed+=Number(x.elapsed_seconds)||0;} if(x.challenge_date)r.days.add(x.challenge_date);}
 return [...map.values()].map(r=>({...r,completed:r.completed.size,days:r.days.size,average:r.days.size?r.score/r.days.size:0})).sort((a,b)=>b.score-a.score||a.elapsed-b.elapsed||a.name.localeCompare(b.name)).slice(0,100);
}
export default async function Leaderboard(){const db=adminClient(),date=uk(),yesterday=prevDate(date);await db.rpc("get_or_create_daily_challenges",{p_date:date}); const today=await aggregate(db,[date]); const allTime=await aggregate(db); const y=await aggregate(db,[yesterday]); const winner=y[0]?{name:y[0].name,score:y[0].score}:null; return <LeaderboardClient today={today} allTime={allTime} yesterdayWinner={winner}/>}
