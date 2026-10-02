"use client";
import {useEffect,useState} from "react";
import Countdown from "./Countdown";
export default function LeaderboardClient({today,allTime,yesterdayWinner}:{today:any[];allTime:any[];yesterdayWinner:any|null}){
 const [tab,setTab]=useState<"today"|"all">("today"); const [me,setMe]=useState("");
 useEffect(()=>{try{setMe(localStorage.getItem("daily-guess:last-player")||"")}catch{}},[]);
 const rows=tab==="today"?today:allTime;
 const myKey=me.trim().toLowerCase(); const rank=rows.findIndex(x=>x.key===myKey)+1;
 return <section className="card" style={{marginTop:40}}><div className="eyebrow">LEADERBOARD</div><h1>{tab==="today"?"Today’s leaderboard":"All-time leaderboard"}</h1><Countdown/><p className="muted small">Ties are broken by fewest clues used, then fastest total time.</p><div className="tabs"><button className={tab==="today"?"tab active":"tab"} onClick={()=>setTab("today")}>Today</button><button className={tab==="all"?"tab active":"tab"} onClick={()=>setTab("all")}>All time</button></div>{rank>0&&<div className="notice leaderboard-position">You are currently <b>#{rank}</b> of {rows.length} players.</div>}{yesterdayWinner&&<div className="success winner"><b>🏆 Yesterday’s winner:</b> {yesterdayWinner.name} — {yesterdayWinner.score}/16</div>}<table className="table"><thead><tr><th>#</th><th>Player</th><th>Score</th><th>Clues</th>{tab==="today"?<th>Progress</th>:<th>Stats</th>}</tr></thead><tbody>{rows.map((x,i)=><tr key={`${x.key}-${i}`} className={x.key===myKey?"me-row":""}><td>{i+1}</td><td><b>{x.name}</b></td><td><b>{x.score}{tab==="today"?"/16":" pts"}</b></td><td>💡 {x.clues||0}</td><td className="muted small">{tab==="today"?`${x.completed}/4 challenges`:`${x.days} days · best ${x.best}/16 · avg ${x.average.toFixed(1)} · ${x.clues||0} clues`}</td></tr>)}</tbody></table>{!rows.length&&<p className="muted">No scores yet.</p>}<a className="btn secondary full" href="/profile">View player profile & stats</a></section>
}
