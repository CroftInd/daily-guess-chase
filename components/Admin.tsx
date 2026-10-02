"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type UploadTarget = { path: string; token: string; contentType: string };
type Challenge = { id:string; title:string; video_path:string; poster_path:string|null; name_answer:string; age_answer:string; occupation_answer:string; from_answer:string; difficulty:string; clues?:Record<string,string>; is_published:boolean; created_at:string; usage?:any };

type Answers = { name:string; age:string; occupation:string; from:string };
const blank: Answers = { name:"", age:"", occupation:"", from:"" };

export default function Admin({ email }: { email: string }) {
  const [title,setTitle]=useState("Who is it?"); const [a,setA]=useState<Answers>(blank);
  const [video,setVideo]=useState<File|null>(null); const [poster,setPoster]=useState<File|null>(null);
  const [msg,setMsg]=useState(""); const [busy,setBusy]=useState(false); const [challenges,setChallenges]=useState<Challenge[]>([]);
  const [clues,setClues]=useState<Record<string,string>>({name:"",age:"",occupation:"",from:""});
  const [editing,setEditing]=useState<Challenge|null>(null); const [query,setQuery]=useState(""); const [difficulty,setDifficulty]=useState("medium");

  async function loadArchive(){
    const r=await fetch("/api/admin/challenges",{cache:"no-store"}); const j=await r.json();
    if(!r.ok) throw new Error(j.error||"Could not load archive."); setChallenges(j.challenges||[]);
  }
  useEffect(()=>{loadArchive().catch(e=>setMsg(e.message));},[]);

  function resetForm(){setTitle("Who is it?");setA(blank);setVideo(null);setPoster(null);setEditing(null);setDifficulty("medium");setClues({name:"",age:"",occupation:"",from:""});}
  function startEdit(c:Challenge){setEditing(c);setTitle(c.title);setA({name:c.name_answer,age:c.age_answer,occupation:c.occupation_answer,from:c.from_answer});setDifficulty(c.difficulty||"medium");setClues({name:c.clues?.name||"",age:c.clues?.age||"",occupation:c.clues?.occupation||"",from:c.clues?.from||""});setVideo(null);setPoster(null);window.scrollTo({top:0,behavior:"smooth"});}

  async function uploadFiles(challengeId?:string){
    if(!video && !poster) return {videoPath: editing?.video_path || "", posterPath: editing?.poster_path || null};
    const prepare=await fetch("/api/admin/publish",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({challengeId,videoName:video?.name||"video.mp4",videoSize:video?.size||0,videoType:video?.type||"video/mp4",posterName:poster?.name||"",posterSize:poster?.size||0,posterType:poster?.type||"image/jpeg"})});
    const prepared=await prepare.json(); if(!prepare.ok) throw new Error(prepared.error||"Could not prepare upload.");
    const supabase=createClient();
    let videoPath=editing?.video_path||"";
    if(video&&prepared.video){setMsg("Uploading video…");const vr=await supabase.storage.from("challenge-media").uploadToSignedUrl((prepared.video as UploadTarget).path,(prepared.video as UploadTarget).token,video);if(vr.error)throw vr.error;videoPath=(prepared.video as UploadTarget).path;}
    let posterPath=editing?.poster_path||null;
    if(poster&&prepared.poster){setMsg("Uploading poster…");const pr=await supabase.storage.from("challenge-media").uploadToSignedUrl((prepared.poster as UploadTarget).path,(prepared.poster as UploadTarget).token,poster);if(pr.error)throw pr.error;posterPath=(prepared.poster as UploadTarget).path;}
    return {videoPath,posterPath};
  }

  async function save(){
    if(busy)return;
    if(Object.values(a).some((v:string)=>!v.trim())||(!editing&&!video)){setMsg("Please provide the video and all four answers.");return;}
    setBusy(true);setMsg(editing?"Preparing update…":"Preparing upload…");
    try{
      if(editing){
        const media=await uploadFiles(editing.id);
        setMsg("Saving changes…");
        const r=await fetch(`/api/admin/challenges/${editing.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,name:a.name,age:a.age,occupation:a.occupation,from:a.from,difficulty,clues,videoPath:media.videoPath,posterPath:media.posterPath})});
        const j=await r.json();if(!r.ok)throw new Error(j.error||"Update failed."); setMsg("Challenge updated successfully.");
      }else{
        const media=await uploadFiles(); setMsg("Publishing challenge…");
        const r=await fetch("/api/admin/publish",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,name:a.name,age:a.age,occupation:a.occupation,from:a.from,difficulty,clues,videoPath:media.videoPath,posterPath:media.posterPath})});
        const j=await r.json();if(!r.ok)throw new Error(j.error||"Publish failed.");setMsg("Challenge published successfully.");
      }
      resetForm(); await loadArchive();
    }catch(e:any){console.error(e);setMsg(e?.message||"Operation failed.");}finally{setBusy(false);}
  }

  async function toggle(c:Challenge){
    setBusy(true);setMsg("Saving status…");try{const r=await fetch(`/api/admin/challenges/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({isPublished:!c.is_published})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not change status.");await loadArchive();setMsg(c.is_published?"Challenge unpublished.":"Challenge published.");}catch(e:any){setMsg(e.message)}finally{setBusy(false)}
  }
  async function remove(c:Challenge){if(!confirm(`Delete “${c.title}”? This cannot be undone.`))return;setBusy(true);try{const r=await fetch(`/api/admin/challenges/${c.id}`,{method:"DELETE"});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not delete challenge.");if(editing?.id===c.id)resetForm();await loadArchive();setMsg("Challenge deleted.");}catch(e:any){setMsg(e.message)}finally{setBusy(false)}}
  async function logout(){await fetch("/api/admin/logout",{method:"POST"});location.href="/admin/login";}

  const filtered=challenges.filter(c=>`${c.title} ${c.name_answer} ${c.occupation_answer} ${c.from_answer}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <section className="card">
      <span className="pill">ADMIN</span><span className="muted small"> {email}</span>
      <button className="btn secondary" style={{float:"right"}} onClick={logout} disabled={busy}>Sign out</button>
      <h1>{editing?"Edit challenge":"Challenge archive"}</h1>
      <div className="notice">Upload reusable challenges here. Every day, the site automatically selects four different published challenges at random from this archive.</div>
      {editing&&<div className="success" style={{marginTop:15}}>Editing <b>{editing.title}</b>. Leave the video/poster blank to keep the existing media.</div>}
      <div className="questions">
        <div className="field"><label>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/></div>
        {([['name','Name'],['age','Age'],['occupation','Occupation'],['from',"Where they're from"]] as const).map(([k,l])=><div className="field" key={k}><label>{l}</label><input value={a[k]} onChange={e=>setA({...a,[k]:e.target.value})} disabled={busy}/></div>)}
      </div>
      <div className="notice"><b>Clues</b> — these are shown to players only when they request help. A clue counts against their daily tie-breaker.</div>
      <div className="questions">
        {([['name','Name clue'],['age','Age clue'],['occupation','Occupation clue'],['from',"Where they're from clue"]] as const).map(([k,l])=><div className="field" key={k}><label>{l}</label><textarea value={clues[k]} onChange={e=>setClues({...clues,[k]:e.target.value})} placeholder="e.g. Their first name starts with J…" maxLength={240} rows={2} disabled={busy}/></div>)}
      </div>
      <div className="questions">
        <div className="field"><label>Difficulty</label><select value={difficulty} onChange={e=>setDifficulty(e.target.value)} disabled={busy}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
        <div className="field"><label>{editing?"Replace video (optional)":"Video"}</label><input type="file" accept="video/*" onChange={e=>setVideo(e.target.files?.[0]||null)} disabled={busy}/>{editing&&<span className="muted small">Existing video will be kept if no file is selected.</span>}</div>
        <div className="field"><label>{editing?"Replace poster (optional)":"First-frame poster"}</label><input type="file" accept="image/*" onChange={e=>setPoster(e.target.files?.[0]||null)} disabled={busy}/></div>
      </div>
      {msg&&<div className={msg.includes("successfully")||msg.includes("unpublished")||msg.includes("published.")?"success":msg.includes("…")?"notice":"error"} style={{marginTop:15}}>{msg}</div>}
      <button className="btn full" onClick={save} disabled={busy}>{busy?(editing?"Saving…":"Publishing…"):(editing?"Save changes":"Publish challenge")}</button>
      {editing&&<button className="btn secondary full" onClick={resetForm} disabled={busy}>Cancel editing</button>}
    </section>

    <section className="card">
      <div className="stats-heading"><div><span className="pill">ARCHIVE</span><h2 style={{margin:"8px 0 0"}}>Submitted challenges ({challenges.length})</h2></div><button className="btn secondary" onClick={()=>loadArchive()} disabled={busy}>Refresh</button></div>
      <div className="field" style={{marginTop:15}}><label>Search archive</label><input placeholder="Search title, name, occupation or location…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <div style={{overflowX:"auto",marginTop:12}}><table className="table"><thead><tr><th>Challenge</th><th>Answers</th><th>Usage</th><th>Status</th><th></th></tr></thead><tbody>
      {filtered.map(c=><tr key={c.id}><td>{c.poster_path&&<img className="archive-thumb" src={createClient().storage.from("challenge-media").getPublicUrl(c.poster_path).data.publicUrl} alt=""/>}<b>{c.title}</b><div className="muted small">{new Date(c.created_at).toLocaleDateString("en-GB")} · <span className="pill">{c.difficulty}</span></div></td><td className="small">{c.name_answer} · {c.age_answer}<br/>{c.occupation_answer} · {c.from_answer}</td><td className="small">{c.usage?.days_used||0} days · {c.usage?.submissions||0} plays<br/>avg {Number(c.usage?.average_score||0).toFixed(1)}/4<br/>N {c.usage?.accuracy?.total?Math.round(c.usage.accuracy.name/c.usage.accuracy.total*100):0}% · A {c.usage?.accuracy?.total?Math.round(c.usage.accuracy.age/c.usage.accuracy.total*100):0}% · O {c.usage?.accuracy?.total?Math.round(c.usage.accuracy.occupation/c.usage.accuracy.total*100):0}% · F {c.usage?.accuracy?.total?Math.round(c.usage.accuracy.from/c.usage.accuracy.total*100):0}%</td><td><span className="pill">{c.is_published?"Published":"Unpublished"}</span></td><td style={{whiteSpace:"nowrap"}}><a className="btn secondary" href={`/admin/preview/${c.id}`}>Preview</a> <button className="btn secondary" onClick={()=>startEdit(c)} disabled={busy}>Edit</button> <button className="btn secondary" onClick={()=>toggle(c)} disabled={busy}>{c.is_published?"Unpublish":"Publish"}</button> <button className="btn secondary" onClick={()=>remove(c)} disabled={busy}>Delete</button></td></tr>)}
      {!filtered.length&&<tr><td colSpan={5} className="muted">No challenges found.</td></tr>}
      </tbody></table></div>
      <p className="muted small">Challenges that have already appeared in a daily draw cannot be deleted because the daily result needs to remain intact. You can unpublish them instead.</p>
    </section>
  </>;
}
