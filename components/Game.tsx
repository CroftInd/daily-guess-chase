"use client";
import {useEffect,useRef,useState} from "react";
import Countdown from "./Countdown";

type Challenge={id:string;slot:number;title:string;posterUrl:string|null;difficulty:string;clues?:Record<string,string>};
type Result={score:number;clueCount:number;breakdown:any[]};
type SavedDay={playerName:string;current:number;results:Result[];done:boolean;completedAt?:number;form:{name:string;age:string;occupation:string;from:string};clueUsage:Record<string,boolean>[];replays:number[]};
const emptyForm={name:"",age:"",occupation:"",from:""};
const qLabels=["name","age","occupation","from"] as const;
const qText:Record<string,string>={name:"Name",age:"Age",occupation:"Occupation",from:"Where are they from?"};

export default function Game({date,challenges,dayNumber}:{date:string;challenges:Challenge[];dayNumber:number}){
 const [playerName,setPlayerName]=useState("");const [current,setCurrent]=useState(0);const [results,setResults]=useState<Result[]>([]);const [done,setDone]=useState(false);const [unlocked,setUnlocked]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [videoUrl,setVideoUrl]=useState<string|null>(null);const [form,setForm]=useState(emptyForm);const [clueUsage,setClueUsage]=useState<Record<string,boolean>[]>([]);const [replays,setReplays]=useState<number[]>([]);const [completedAt,setCompletedAt]=useState<number|undefined>(undefined);const [loaded,setLoaded]=useState(false);const [startedAt,setStartedAt]=useState(Date.now());const [videoTime,setVideoTime]=useState(0);const [videoDuration,setVideoDuration]=useState(0);
 const v=useRef<HTMLVideoElement>(null); const storageKey=`daily-guess:${date}`; const challenge=challenges[current];
 useEffect(()=>{
  // The public game URL is date-less, so reload at UK midnight to pick up the new daily draw.
  const getUkDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const initial=getUkDate();
  const timer=window.setInterval(()=>{if(getUkDate()!==initial) window.location.replace("/");},15000);
  return()=>window.clearInterval(timer);
 },[]);

 useEffect(()=>{try{const raw=localStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw) as SavedDay;setPlayerName(saved.playerName||"");setCurrent(Math.min(Math.max(Number(saved.current)||0,0),Math.max(challenges.length-1,0)));setResults(Array.isArray(saved.results)?saved.results.slice(0,challenges.length):[]);setCompletedAt(typeof saved.completedAt==="number"?saved.completedAt:undefined);setDone(Boolean(saved.done&&typeof saved.completedAt==="number"));if(saved.form)setForm(saved.form);if(Array.isArray(saved.clueUsage))setClueUsage(saved.clueUsage.slice(0,challenges.length));if(Array.isArray(saved.replays))setReplays(saved.replays)}}catch{}setLoaded(true)},[date,storageKey,challenges.length]);
 useEffect(()=>{if(!loaded)return;try{localStorage.setItem(storageKey,JSON.stringify({playerName,current,results,done,completedAt,form,clueUsage,replays} as SavedDay));if(playerName)localStorage.setItem("daily-guess:last-player",playerName)}catch{}},[loaded,storageKey,playerName,current,results,done,completedAt,form,clueUsage,replays]);
 useEffect(()=>{setUnlocked(Boolean(results[current]));setVideoUrl(null);setStartedAt(Date.now());setVideoTime(0);setVideoDuration(0);const x=v.current;if(x){x.pause();x.currentTime=0;x.load()}if(results[current]&&playerName.trim()&&challenge){fetch(`/api/video/${challenge.id}?date=${encodeURIComponent(date)}&displayName=${encodeURIComponent(playerName.trim())}`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).then(j=>setVideoUrl(j.videoUrl)).catch(()=>{})}},[current,results,date,playerName,challenge?.id]);
 useEffect(()=>{const x=v.current;if(!x)return;const f=()=>{if(!unlocked){x.pause();x.currentTime=0}};x.addEventListener("play",f);return()=>x.removeEventListener("play",f)},[unlocked]);
 const update=(k:string,val:string)=>setForm({...form,[k]:val});
 const requestClue=(k:string)=>{if(unlocked||!challenge?.clues?.[k])return;setClueUsage(prev=>{const next=[...prev];next[current]={...(next[current]||{}),[k]:true};return next});};
 async function submit(e:React.FormEvent){e.preventDefault();if(busy||!challenge)return;if(!playerName.trim()){setError("Please enter your player name first.");return}setBusy(true);setError("");try{const elapsed=Math.max(1,Math.round((Date.now()-startedAt)/1000));const usage=clueUsage[current]||{};const r=await fetch("/api/submit",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeId:challenge.id,date,displayName:playerName.trim(),answers:form,clueUsage:usage,elapsedSeconds:elapsed})});const j=await r.json();if(!r.ok)throw Error(j.error||"Submission failed.");setResults(prev=>{const next=[...prev];next[current]=j;return next;});setUnlocked(true);try{const vr=await fetch(`/api/video/${challenge.id}?date=${encodeURIComponent(date)}&displayName=${encodeURIComponent(playerName.trim())}`,{cache:"no-store"});if(vr.ok)setVideoUrl((await vr.json()).videoUrl)}catch{}/* Keep the final challenge on screen so its unlocked video can be played. */
}catch(e:any){setError(e.message||"Submission failed")}finally{setBusy(false)}}
 function replay(){setReplays(prev=>{const next=[...prev];next[current]=(next[current]||0)+1;return next});v.current?.play().catch(()=>{})}
 const total=results.reduce((n,r)=>n+r.score,0); const totalClues=results.reduce((n,r)=>n+(r.clueCount||0),0);
 if(!loaded)return <section className="card"><p className="muted">Loading today’s challenge…</p></section>;
 if(done)return <DailyStats date={date} dayNumber={dayNumber} playerName={playerName} results={results} total={total} totalClues={totalClues} replays={replays}/>;
 if(!challenge)return <section className="card"><h2>No challenges published yet.</h2></section>;
 const usage=clueUsage[current]||{};
 return <>
  <section className="hero"><div className="eyebrow">DAY #{dayNumber} · {date} · CHALLENGE {current+1} OF {challenges.length}</div><h1>Daily Guess</h1><p>Four clips. Four guesses each. Maximum score: 16.</p></section>
  <section className="card">
   <div className="progress"><span style={{width:`${(current/challenges.length)*100}%`}}/></div>
   <div className="challenge-meta"><span className="pill">{challenge.difficulty.toUpperCase()}</span><span className="muted small">Challenge {current+1}/4</span></div>
   <div className="player-field field"><label>Your leaderboard name</label><input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="Enter the name you want shown" disabled={results.length>current}/><span className="muted small">Separate from your “Name” guess.</span></div>
   <div className="video"><video key={`${challenge.id}-${videoUrl||"locked"}`} ref={v} src={videoUrl||undefined} poster={challenge.posterUrl||undefined} playsInline controls={unlocked&&!!videoUrl} onTimeUpdate={e=>setVideoTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setVideoDuration(e.currentTarget.duration)}/>{!unlocked&&<div className="locked-badge"><span>🔒</span><div><b>Video locked</b><div className="muted small">Submit your four guesses to play</div></div></div>}</div>
   {unlocked&&videoUrl&&<div className="video-time">▶ {Math.floor(videoTime/60)}:{String(Math.floor(videoTime%60)).padStart(2,"0")} / {Math.floor(videoDuration/60)}:{String(Math.floor(videoDuration%60)).padStart(2,"0")}</div>}
   <form onSubmit={submit}>
    <div className="questions">{qLabels.map(k=><div className="field" key={k}><div className="question-label"><label>{qText[k]}</label>{challenge.clues?.[k]&&<button type="button" className={`clue-btn${usage[k]?" used":""}`} onClick={()=>requestClue(k)} disabled={unlocked||!!usage[k]}>{usage[k]?"💡 Clue used":"💡 Ask for clue"}</button>}</div><input required value={(form as any)[k]} onChange={e=>update(k,e.target.value)} inputMode={k==="age"?"numeric":undefined} disabled={unlocked}/>{usage[k]&&challenge.clues?.[k]&&<div className="clue-box">💡 {challenge.clues[k]}</div>}</div>)}</div>
    {error&&<div className="error" style={{marginTop:14}}>{error}</div>}{!unlocked&&<div className="submit-meta"><span className="muted small">Clues used: {Object.values(usage).filter(Boolean).length}/4</span><button className="btn full" disabled={busy}>{busy?"Checking guesses…":`Submit challenge ${current+1}`}</button></div>}
   </form>
  </section>
  {results[current] ? <ResultCard result={results[current]} replayCount={replays[current]||0} replay={replay} done={current===challenges.length-1} next={()=>{if(current===challenges.length-1){setCompletedAt(Date.now());setDone(true);return;}setCurrent(Math.min(current+1,challenges.length-1));setForm(emptyForm);setError("")}}/> : null}
 </>;
}

function DailyStats({date,dayNumber,playerName,results,total,totalClues,replays}:{date:string;dayNumber:number;playerName:string;results:Result[];total:number;totalClues:number;replays:number[]}){
 const [stats,setStats]=useState<any>(null);useEffect(()=>{fetch(`/api/player/stats?name=${encodeURIComponent(playerName)}`,{cache:"no-store"}).then(r=>r.json()).then(setStats).catch(()=>{})},[playerName]);
 const correct=results.reduce((n,r)=>n+r.score,0);const questions=results.length*4;const accuracy=questions?correct/questions*100:0;
 async function share(){const text=`I scored ${total}/16 on Daily Guess today! 🎯`;if(navigator.share)try{await navigator.share({title:"Daily Guess",text,url:location.origin})}catch{}else{await navigator.clipboard?.writeText(`${text} ${location.origin}`);alert("Score copied to clipboard!")}}
 return <section><section className="hero"><div className="eyebrow">DAY #{dayNumber} · {date} · DAILY RESULTS</div><h1>Your day</h1><p>You’ve completed all four challenges.</p></section><section className={`card stats-summary${total>=16?" perfect-day":""}`}><div className={`score${total>=16?" score-perfect":""}`}>{total} / 16</div><div className="scoreline">{accuracy.toFixed(1)}% accuracy · <b>{totalClues} clues used</b> · leaderboard name: <b>{playerName}</b></div><div className="stat-pills"><span className="pill">🔥 {stats?.currentStreak||0} day streak</span><span className="pill">🏆 best {stats?.best||total}/16</span><span className="pill">💡 {stats?.totalClues??totalClues} total clues</span><span className="pill">⚡ fastest {stats?.fastest||"—"}s</span></div><button className="btn full" onClick={share}>Share my score</button></section>
 <section className="card feature-card"><div className="eyebrow">ACHIEVEMENTS</div><div className="achievement-grid">{(stats?.achievements||[]).map((a:any)=><div className="achievement" key={a.id}><span>{a.icon}</span><b>{a.name}</b><small>{a.desc}</small></div>)}{!stats?.achievements?.length&&<p className="muted">Keep playing to unlock achievements.</p>}</div></section>
 <section className="card feature-card"><div className="eyebrow">ALL ANSWERS</div><h2>Everything you guessed today</h2>{results.map((result,i)=><StatsChallenge key={i} result={result} index={i} replays={replays[i]||0}/>)}<Countdown/><a className="btn full" href="/leaderboard">View leaderboard</a><a className="btn secondary full" href="/profile">View full player profile</a></section></section>;
}

function ResultCard({result,replayCount,replay,done,next}:{result:Result;replayCount:number;replay:()=>void;done:boolean;next:()=>void}){return <section className="card"><div className="score">{result.score} / 4</div><div className="scoreline">Challenge score · {result.clueCount||0} clues used · {replayCount} replays</div>{result.breakdown.map((x:any)=><div className="answer" key={x.key}><b>{x.label}</b> <span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span><div className="muted small">Your answer: {x.guess} · Correct: {x.correctAnswer}</div></div>)}<button className="btn secondary full" onClick={replay}>Watch video again · {replayCount}</button>{done?<button className="btn full" onClick={next}>Finish day →</button>:<button className="btn full" onClick={next}>Next challenge →</button>}</section>}
function StatsChallenge({result,index,replays}:{result:Result;index:number;replays:number}){return <div className="stats-challenge"><div className="stats-heading"><b>Challenge {index+1}</b><span className="pill">{result.score}/4</span></div>{result.breakdown.map((x:any)=><div className="answer" key={x.key}><div className="stats-answer-heading"><b>{x.label}</b><span className={x.correct?"ok":"no"}>{x.correct?"✓ Correct":"✗ Incorrect"}</span></div><div className="muted small"><b>Your answer:</b> {x.guess||"—"}</div><div className="muted small"><b>Correct answer:</b> {x.correctAnswer}</div></div>)}<div className="muted small">💡 Clues used: {result.clueCount||0} · Replays: {replays}</div></div>}
