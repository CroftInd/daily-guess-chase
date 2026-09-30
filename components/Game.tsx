"use client";
import { useEffect, useRef, useState } from "react";
import Countdown from "./Countdown";

type Challenge = { id:string; slot:number; title:string; posterUrl:string|null };
type Result = { score:number; breakdown:any[] };
type SavedDay = { playerName:string; current:number; results:Result[]; done:boolean; form:{name:string;age:string;occupation:string;from:string} };

export default function Game({ date, challenges }: { date:string; challenges:Challenge[] }) {
  const [playerName,setPlayerName]=useState("");
  const [current,setCurrent]=useState(0);
  const [results,setResults]=useState<Result[]>([]);
  const [done,setDone]=useState(false);
  const [unlocked,setUnlocked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [videoUrl,setVideoUrl]=useState<string | null>(null);
  const [form,setForm]=useState({name:"",age:"",occupation:"",from:""});
  const [loaded,setLoaded]=useState(false);
  const v=useRef<HTMLVideoElement>(null);
  const storageKey=`daily-guess:${date}`;
  const challenge=challenges[current];

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(storageKey);
      if(raw){
        const saved=JSON.parse(raw) as SavedDay;
        setPlayerName(saved.playerName||"");
        setCurrent(Math.min(saved.current||0, Math.max(challenges.length-1,0)));
        setResults(Array.isArray(saved.results)?saved.results:[]);
        setDone(Boolean(saved.done));
        if(saved.form) setForm(saved.form);
      }
    } catch {}
    setLoaded(true);
  },[date,storageKey,challenges.length]);

  useEffect(()=>{
    if(!loaded) return;
    const saved:SavedDay={playerName,current,results,done,form};
    try { localStorage.setItem(storageKey,JSON.stringify(saved)); } catch {}
  },[loaded,storageKey,playerName,current,results,done,form]);

  useEffect(()=>{
    setUnlocked(Boolean(results[current]));
    setVideoUrl(null);
    const x=v.current; if(!x)return; x.pause(); x.currentTime=0;
    if(results[current] && playerName.trim() && challenge) {
      fetch(`/api/video/${challenge.id}?date=${encodeURIComponent(date)}&displayName=${encodeURIComponent(playerName.trim())}`, { cache:"no-store" })
        .then(r=>r.ok?r.json():Promise.reject(new Error("Video unavailable")))
        .then(j=>setVideoUrl(j.videoUrl))
        .catch(()=>{});
    }
  },[current,results,date,playerName,challenge]);
  useEffect(()=>{const x=v.current;if(!x)return;const f=()=>{if(!unlocked){x.pause();x.currentTime=0}};x.addEventListener("play",f);return()=>x.removeEventListener("play",f)},[unlocked]);

  const u=(k:string,val:string)=>setForm({...form,[k]:val});
  async function submit(e:React.FormEvent){
    e.preventDefault(); if(busy||!challenge)return;
    if(!playerName.trim()){setError("Please enter your player name first.");return;}
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeId:challenge.id,date,displayName:playerName.trim(),answers:form})});
      const j=await r.json(); if(!r.ok)throw Error(j.error||"Submission failed.");
      setResults(prev=>[...prev,j]);
      const vr = await fetch(`/api/video/${challenge.id}?date=${encodeURIComponent(date)}&displayName=${encodeURIComponent(playerName.trim())}`, { cache:"no-store" });
      if(vr.ok){ const vj=await vr.json(); setVideoUrl(vj.videoUrl); setUnlocked(true); }
      else { setUnlocked(true); }
      setTimeout(()=>v.current?.play().catch(()=>{}),250);
      if(current===challenges.length-1)setDone(true);
    }catch(e:any){setError(e.message||"Submission failed")}finally{setBusy(false)}
  }

  const total=results.reduce((n,r)=>n+r.score,0);

  if(!loaded)return <section className="card"><p className="muted">Loading today’s challenge…</p></section>;

  if(done) return <DailyStats date={date} playerName={playerName} results={results} total={total}/>;
  if(!challenge)return <section className="card"><h2>No challenges published yet.</h2></section>;

  return <>
    <section className="hero"><div className="eyebrow">{date} · Challenge {current+1} of {challenges.length}</div><h1>Daily Guess</h1><p>Make four guesses before each video reveals the answer.</p></section>
    <section className="card">
      <div className="progress"><span style={{width:`${(current/challenges.length)*100}%`}}/></div>
      <div className="player-field field"><label>Your leaderboard name</label><input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Enter the name you want shown" disabled={results.length>current}/><span className="muted small">This is shown on the leaderboard — it is separate from your “Name” guess.</span></div>
      <div className="video"><video ref={v} src={videoUrl||undefined} poster={challenge.posterUrl||undefined} playsInline controls={unlocked&&!!videoUrl}/>{!unlocked&&<div className="locked-badge"><span>🔒</span><div><b>Video locked</b><div className="muted small">Submit your four guesses to play</div></div></div>}</div>
      <form onSubmit={submit}>
        <div className="questions">{[["name","Name"],["age","Age"],["occupation","Occupation"],["from","Where are they from?"]].map(([k,l])=><div className="field" key={k}><label>{l}</label><input required value={(form as any)[k]} onChange={e=>u(k,e.target.value)} inputMode={k==="age"?"numeric":undefined} disabled={unlocked}/></div>)}</div>
        {error&&<div className="error" style={{marginTop:14}}>{error}</div>}
        {!unlocked&&<button className="btn full" disabled={busy}>{busy?"Checking guesses…":`Submit challenge ${current+1}`}</button>}
      </form>
    </section>
    {results[current]&&<section className="card"><div className="score">{results[current].score} / 4</div><div className="scoreline">Challenge {current+1} score</div>{results[current].breakdown.map((x:any)=><div className="answer" key={x.key}><b>{x.label}</b> <span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span><div className="muted small">Your answer: {x.guess} · Correct: {x.correctAnswer}</div></div>)}<button className="btn secondary full" onClick={()=>v.current?.play().catch(()=>{})}>Watch video again</button>{!done&&<button className="btn full" onClick={()=>{setCurrent(current+1);setForm({name:"",age:"",occupation:"",from:""})}}>Next challenge →</button>}</section>}
  </>
}

function DailyStats({date,playerName,results,total}:{date:string;playerName:string;results:Result[];total:number}){
  return <section>
    <section className="hero"><div className="eyebrow">{date} · DAILY RESULTS</div><h1>Your day</h1><p>You’ve completed all four challenges. Your playthrough is saved on this browser for today.</p></section>
    <section className="card stats-summary"><div className="score">{total} / 16</div><div className="scoreline">Total score</div><p className="muted" style={{textAlign:"center"}}>Leaderboard name: <b style={{color:"#fff"}}>{playerName}</b></p></section>
    <section className="card"><div className="eyebrow">ALL ANSWERS</div><h2>Everything you guessed today</h2>
      {results.map((result,i)=><div className="stats-challenge" key={i}>
        <div className="stats-heading"><b>Challenge {i+1}</b><span className="pill">{result.score} / 4</span></div>
        {result.breakdown.map((x:any)=><div className="answer" key={x.key}><div className="stats-answer-heading"><b>{x.label}</b><span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span></div><div className="muted small"><b>Your answer:</b> {x.guess || "—"}</div><div className="muted small"><b>Correct answer:</b> {x.correctAnswer}</div></div>)}
      </div>)}
      <Countdown />
      <a className="btn full" href="/leaderboard">View today’s leaderboard</a>
    </section>
  </section>
}
