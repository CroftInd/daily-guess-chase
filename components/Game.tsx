"use client";
import { useEffect, useRef, useState } from "react";

type Challenge = { id:string; slot:number; title:string; videoUrl:string; posterUrl:string|null };
type Result = { score:number; breakdown:any[] };

export default function Game({ date, challenges }: { date:string; challenges:Challenge[] }) {
  const [playerName,setPlayerName]=useState("");
  const [current,setCurrent]=useState(0);
  const [results,setResults]=useState<Result[]>([]);
  const [done,setDone]=useState(false);
  const [unlocked,setUnlocked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [form,setForm]=useState({name:"",age:"",occupation:"",from:""});
  const v=useRef<HTMLVideoElement>(null);
  const challenge=challenges[current];

  useEffect(()=>{setUnlocked(false); const x=v.current; if(!x)return; x.pause(); x.currentTime=0;},[current]);
  useEffect(()=>{const x=v.current;if(!x)return;const f=()=>{if(!unlocked){x.pause();x.currentTime=0}};x.addEventListener("play",f);return()=>x.removeEventListener("play",f)},[unlocked]);

  const u=(k:string,val:string)=>setForm({...form,[k]:val});
  async function submit(e:React.FormEvent){
    e.preventDefault(); if(busy||!challenge)return;
    if(!playerName.trim()){setError("Please enter your player name first.");return;}
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeId:challenge.id,date,displayName:playerName.trim(),answers:form})});
      const j=await r.json(); if(!r.ok)throw Error(j.error||"Submission failed.");
      setResults(prev=>[...prev,j]);setUnlocked(true);
      setTimeout(()=>v.current?.play().catch(()=>{}),100);
      if(current===challenges.length-1)setDone(true);
    }catch(e:any){setError(e.message||"Submission failed")}finally{setBusy(false)}
  }

  if(!challenge)return <section className="card"><h2>No challenges published yet.</h2></section>;
  const total=results.reduce((n,r)=>n+r.score,0);
  return <>
    <section className="hero"><div className="eyebrow">{date} · Challenge {current+1} of {challenges.length}</div><h1>Daily Guess</h1><p>Make four guesses before each video reveals the answer.</p></section>
    <section className="card">
      <div className="progress"><span style={{width:`${(current/challenges.length)*100}%`}}/></div>
      <div className="player-field field"><label>Your leaderboard name</label><input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Enter the name you want shown" disabled={results.length>current}/><span className="muted small">This is shown on the leaderboard — it is separate from your “Name” guess.</span></div>
      <div className="video"><video ref={v} src={challenge.videoUrl} poster={challenge.posterUrl||undefined} playsInline controls={unlocked}/>{!unlocked&&<div className="locked-badge"><span>🔒</span><div><b>Video locked</b><div className="muted small">Submit your four guesses to play</div></div></div>}</div>
      <form onSubmit={submit}>
        <div className="questions">{[["name","Name"],["age","Age"],["occupation","Occupation"],["from","Where are they from?"]].map(([k,l])=><div className="field" key={k}><label>{l}</label><input required value={(form as any)[k]} onChange={e=>u(k,e.target.value)} inputMode={k==="age"?"numeric":undefined} disabled={unlocked}/></div>)}</div>
        {error&&<div className="error" style={{marginTop:14}}>{error}</div>}
        {!unlocked&&<button className="btn full" disabled={busy}>{busy?"Checking guesses…":`Submit challenge ${current+1}`}</button>}
      </form>
    </section>
    {results[current]&&<section className="card"><div className="score">{results[current].score} / 4</div><div className="scoreline">Challenge {current+1} score</div>{results[current].breakdown.map((x:any)=><div className="answer" key={x.key}><b>{x.label}</b> <span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span><div className="muted small">Your answer: {x.guess} · Correct: {x.correctAnswer}</div></div>)}<button className="btn secondary full" onClick={()=>v.current?.play().catch(()=>{})}>Watch video again</button>{!done&&<button className="btn full" onClick={()=>{setCurrent(current+1);setForm({name:"",age:"",occupation:"",from:""})}}>Next challenge →</button>}</section>}
    {done&&<section className="card"><div className="eyebrow">DAILY RESULT</div><div className="score">{total} / 16</div><div className="scoreline">Your total score for today</div><p className="muted" style={{textAlign:"center"}}>Leaderboard name: <b style={{color:"#fff"}}>{playerName}</b></p><a className="btn full" href="/leaderboard">View today’s leaderboard</a></section>}
  </>
}
