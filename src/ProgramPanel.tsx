import React, { useState } from 'react';
import type { Data } from './storage';
import { duplicate, nextSession, parseProgram, startProgram, startProgramSession, totalSessions } from './programs';

const programFiles = import.meta.glob<unknown>('../programs/*.json', { eager: true, import: 'default' });
const bundledPrograms = Object.values(programFiles).map(parseProgram);

export function ProgramPanel({data:d,busy,save,openWorkout}:{data:Data;busy:boolean;save:(d:Data)=>Promise<boolean>;openWorkout:()=>void}){
 const [selected,setSelected]=useState<string>();
 const [error,setError]=useState('');
 const programs = [...d.programs, ...bundledPrograms.filter(program => !duplicate(d.programs, program))];
 const run=d.runs.find(r=>r.id===d.activeRunId);
 const current=d.programs.find(p=>p.id===run?.programId);
 const next=current&&run?nextSession(current,run):null;
 const p=programs.find(p=>p.id===(selected??current?.id));
 const viewedRuns=d.runs.filter(r=>r.programId===p?.id);
 const viewedRun=viewedRuns.at(-1);

 async function launch(){
  setError('');
  try{if(await save(startProgramSession(d)))openWorkout();}catch(e){setError((e as Error).message);}
 }

 async function startSelected(){
  if(!p)return;
  setError('');
  try{
   if(run&&!confirm('Starta en ny programomgång? Tidigare framsteg och historik behålls.'))return;
   await save(startProgram(d,p));
  }catch(e){setError((e as Error).message);}
 }

 return <>
  <div className="eyebrow">TRÄNA I DITT TEMPO</div>
  <h1>Program<span>.</span></h1>
  <p>Välj program och följ passen vecka för vecka, utan kalenderkrav.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  {(current||d.active)&&<section className="card">
   <h2>{current?.name??'Pågående pass'}</h2>
   {run&&current&&<>
    <p>{run.completed.length} / {totalSessions(current)} pass genomförda{run.finished?' · Programmet är färdigt!':''}</p>
    <progress aria-label="Programframsteg" value={run.completed.length} max={totalSessions(current)}/>
    {next&&<p>Nästa pass: Vecka {next.week+1}, pass {next.session+1} – {next.workout.name}</p>}
   </>}
   {d.active?<button className="primary" onClick={openWorkout}>Fortsätt pass →</button>:next&&<button disabled={busy} className="primary" onClick={launch}>Starta pass · Nästa pass →</button>}
  </section>}
  <section className="card">
   <h2>Välj program</h2>
   {programs.map(program=><div className="detail" key={program.id}>
    <span>{program.name}<small>{program.weeks.length} veckor · {totalSessions(program)} pass</small></span>
    <button className="secondary" aria-pressed={p?.id===program.id} aria-label={'Välj '+program.name} onClick={()=>{setError('');setSelected(program.id);}}>Välj</button>
   </div>)}
  </section>
  {p&&<section className="card">
   <h2>{p.name}</h2>
   <p>{p.weeks.length} veckor · {totalSessions(p)} pass</p>
   <button className="primary" disabled={busy||!!d.active} onClick={startSelected}>{run?.programId===p.id?'Starta ny omgång':'Starta program'}</button>
   {d.active&&<p>Avsluta eller kasta pågående pass innan du byter program.</p>}
   <button className="secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='forma-program.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Exportera program ↓</button>
   {p.weeks.map((w,wi)=><details key={wi} open={p.id===current?.id&&wi===next?.week}>
    <summary>{w.name} · {w.sessions.length} pass</summary>
    <p>{w.sessions.reduce((n,s)=>n+s.exercises.reduce((n,e)=>n+e.sets,0),0)} set · {w.sessions.reduce((n,s)=>n+s.exercises.reduce((n,e)=>n+e.totalReps,0),0)} planerade reps totalt</p>
    {w.sessions.map((s,si)=>{
     const done=viewedRun?.completed.find(c=>c.week===wi&&c.session===si);
     return <div className="program-session" key={si}>
      <h3>{done?'✓ ':p.id===current?.id&&wi===next?.week&&si===next.session?'Nästa: ':''}Pass {si+1} – {s.name}</h3>
      {done&&<p>Genomfört {new Date(done.date).toLocaleDateString('sv-SE')}</p>}
      <ol>{s.exercises.map((e,i)=><li key={i}>{e.name}: {e.sets} set, {e.totalReps} reps totalt{e.repsPerSet?' ('+e.repsPerSet.join(' / ')+')':e.totalReps%e.sets?' · fördelning ej angiven':''}</li>)}</ol>
     </div>;
    })}
   </details>)}
   {viewedRun&&<p>{viewedRuns.length} sparade omgångar. Tidigare resultat finns i Historik.</p>}
  </section>}
 </>;
}
