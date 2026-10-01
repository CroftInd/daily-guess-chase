"use client";
import { useEffect, useRef, useState } from "react";
import Countdown from "./Countdown";

type Challenge = { id:string; slot:number; title:string; posterUrl:string|null };
type Result = { score:number; breakdown:any[] };
type SavedDay = { attemptId:string; playerName:string; current:number; results:Result[]; done:boolean; leaderboardSubmitted:boolean; form:{name:string;age:string;occupation:string;from:string} };

function newAttemptId(){
  if(typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function Game({ date, challenges }: { date:string; challenges:Challenge[] }) {
  const [attemptId,setAttemptId]=useState("");
  const [playerName,setPlayerName]=useState("");
  const [current,setCurrent]=useState(0);
  const [results,setResults]=useState<Result[]>([]);
  const [done,setDone]=useState(false);
  const [leaderboardSubmitted,setLeaderboardSubmitted]=useState(false);
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
        const saved=JSON.parse(raw) as Partial<SavedDay>;
        setAttemptId(saved.attemptId || newAttemptId());
        setPlayerName(saved.playerName||"");
        setCurrent(Math.min(saved.current||0, Math.max(challenges.length-1,0)));
        setResults(Array.isArray(saved.results)?saved.results:[]);
        setDone(Boolean(saved.done));
        setLeaderboardSubmitted(Boolean(saved.leaderboardSubmitted));
        if(saved.form) setForm(saved.form);
      } else {
        setAttemptId(newAttemptId());
      }
    } catch { setAttemptId(newAttemptId()); }
    setLoaded(true);
  },[date,storageKey,challenges.length]);

  useEffect(()=>{
    if(!loaded || !attemptId) return;
    const saved:SavedDay={attemptId,playerName,current,results,done,leaderboardSubmitted,form};
    try { localStorage.setItem(storageKey,JSON.stringify(saved)); } catch {}
  },[loaded,storageKey,attemptId,playerName,current,results,done,leaderboardSubmitted,form]);

  useEffect(()=>{
    setUnlocked(Boolean(results[current]));
    setVideoUrl(null);
    const x=v.current; if(x){x.pause();x.currentTime=0;}
    if(results[current] && attemptId && challenge) {
      fetch(`/api/video/${challenge.id}?date=${encodeURIComponent(date)}&attemptId=${encodeURIComponent(attemptId)}`, { cache:"no-store" })
        .then(r=>r.ok?r.json():Promise.reject(new Error("Video unavailable")))
        .then(j=>setVideoUrl(j.videoUrl))
        .catch(()=>{});
    }
  },[current,results,date,attemptId,challenge]);

  useEffect(()=>{const x=v.current;if(!x)return;const f=()=>{if(!unlocked){x.pause();x.currentTime=0}};x.addEventListener("play",f);return()=>x.removeEventListener("play",f)},[unlocked]);

  const u=(k:string,val:string)=>setForm({...form,[k]:val});
  async function submit(e:React.FormEvent){
    e.preventDefault(); if(busy||!challenge||!attemptId)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeId:challenge.id,date,attemptId,answers:form})});
      const j=await r.json(); if(!r.ok)throw Error(j.error||"Submission failed.");
      setResults(prev=>[...prev,j]);
      const vr = await fetch(`/api/video/${challenge.id}?date=${encodeURIComponent(date)}&attemptId=${encodeURIComponent(attemptId)}`, { cache:"no-store" });
      if(vr.ok){ const vj=await vr.json(); setVideoUrl(vj.videoUrl); setUnlocked(true); }
      else { setUnlocked(true); }
      setTimeout(()=>v.current?.play().catch(()=>{}),250);
      if(current===challenges.length-1)setDone(true);
    }catch(e:any){setError(e.message||"Submission failed")}finally{setBusy(false)}
  }

  const total=results.reduce((n,r)=>n+r.score,0);

  if(!loaded)return <section className="card"><p className="muted">Loading today’s challenge…</p></section>;

  if(done) return <DailyComplete date={date} attemptId={attemptId} playerName={playerName} setPlayerName={setPlayerName} results={results} total={total} leaderboardSubmitted={leaderboardSubmitted} setLeaderboardSubmitted={setLeaderboardSubmitted}/>;
  if(!challenge)return <section className="card"><h2>No challenges published yet.</h2></section>;

  return <>
    <section className="hero"><div className="eyebrow">{date} · Challenge {current+1} of {challenges.length}</div><h1>Daily Guess</h1><p>Make four guesses before each video reveals the answer.</p></section>
    <section className="card">
      <div className="progress"><span style={{width:`${(current/challenges.length)*100}%`}}/></div>
      <div className="video"><video key={challenge.id} ref={v} src={videoUrl||undefined} poster={challenge.posterUrl||undefined} playsInline controls={unlocked&&!!videoUrl}/>{!unlocked&&<div className="locked-badge"><span>🔒</span><div><b>Video locked</b><div className="muted small">Submit your four guesses to play</div></div></div>}</div>
      <form onSubmit={submit}>
        <div className="questions">{[["name","Name"],["age","Age"],["occupation","Occupation"],["from","Where are they from?"]].map(([k,l])=><div className="field" key={k}><label>{l}</label><input required value={(form as any)[k]} onChange={e=>u(k,e.target.value)} inputMode={k==="age"?"numeric":undefined} disabled={unlocked}/></div>)}</div>
        {error&&<div className="error" style={{marginTop:14}}>{error}</div>}
        {!unlocked&&<button className="btn full" disabled={busy}>{busy?"Checking guesses…":`Submit challenge ${current+1}`}</button>}
      </form>
    </section>
    {results[current]&&<section className="card"><div className="score">{results[current].score} / 4</div><div className="scoreline">Challenge {current+1} score</div>{results[current].breakdown.map((x:any)=><div className="answer" key={x.key}><b>{x.label}</b> <span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span><div className="muted small">Your answer: {x.guess} · Correct: {x.correctAnswer}</div></div>)}<button className="btn secondary full" onClick={()=>v.current?.play().catch(()=>{})}>Watch video again</button>{!done&&<button className="btn full" onClick={()=>{setCurrent(current+1);setForm({name:"",age:"",occupation:"",from:""})}}>Next challenge →</button>}</section>}
  </>
}

function DailyComplete({date,attemptId,playerName,setPlayerName,results,total,leaderboardSubmitted,setLeaderboardSubmitted}:{date:string;attemptId:string;playerName:string;setPlayerName:(v:string)=>void;results:Result[];total:number;leaderboardSubmitted:boolean;setLeaderboardSubmitted:(v:boolean)=>void}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const submitLeaderboard=async(e:React.FormEvent)=>{
    e.preventDefault();
    const name=playerName.trim();
    if(!name){setError("Please enter the name you want shown on the leaderboard.");return;}
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/leaderboard/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({date,attemptId,displayName:name})});
      const j=await r.json();
      if(!r.ok) throw Error(j.error||"Leaderboard submission failed.");
      setLeaderboardSubmitted(true);
    }catch(e:any){setError(e.message||"Leaderboard submission failed.")}finally{setBusy(false)}
  };

  return <section>
    <section className="hero"><div className="eyebrow">{date} · ALL CHALLENGES COMPLETE</div><h1>Your day</h1><p>You’ve completed all four challenges. Here are your results and your leaderboard submission.</p></section>
    <section className="card stats-summary"><div className="score">{total} / 16</div><div className="scoreline">Total score</div></section>

    <section className="card leaderboard-submit-card">
      <div className="eyebrow">SUBMIT TO LEADERBOARD</div>
      {leaderboardSubmitted ? <>
        <h2>Score submitted ✓</h2>
        <p className="muted">Your <b style={{color:"#fff"}}>{playerName}</b> score of <b style={{color:"#fff"}}>{total}/16</b> is now on today’s leaderboard.</p>
        <a className="btn full" href="/leaderboard">View today’s leaderboard</a>
      </> : <>
        <h2>Choose your leaderboard name</h2>
        <p className="muted">This name is only for the leaderboard and is separate from your “Name” guesses.</p>
        <form onSubmit={submitLeaderboard}>
          <div className="field"><label>Leaderboard name</label><input maxLength={40} value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Enter the name you want shown" autoFocus/></div>
          {error&&<div className="error" style={{marginTop:14}}>{error}</div>}
          <button className="btn full" disabled={busy}>{busy?"Submitting…":"Submit to leaderboard"}</button>
        </form>
      </>}
    </section>

    <section className="card"><div className="eyebrow">ALL ANSWERS</div><h2>Everything you guessed today</h2>
      {results.map((result,i)=><div className="stats-challenge" key={i}>
        <div className="stats-heading"><b>Challenge {i+1}</b><span className="pill">{result.score} / 4</span></div>
        {result.breakdown.map((x:any)=><div className="answer" key={x.key}><div className="stats-answer-heading"><b>{x.label}</b><span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span></div><div className="muted small"><b>Your answer:</b> {x.guess || "—"}</div><div className="muted small"><b>Correct answer:</b> {x.correctAnswer}</div></div>)}
      </div>)}
      <Countdown />
    </section>
  </section>
}
