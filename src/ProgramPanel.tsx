import React, { useState } from 'react';
import type { Data } from './storage';
import { duplicate, followedPrograms, followProgram, parseProgram, totalSessions, unfollowProgram } from './programs';
import type { WorkoutSelection } from './workouts';

const programFiles = import.meta.glob<unknown>('../programs/*.json', { eager: true, import: 'default' });
const bundledPrograms = Object.values(programFiles).map(parseProgram);

type FollowedProgram = ReturnType<typeof followedPrograms>[number];
export function ProgramProgress({program,run,next}:FollowedProgram){
 return <>
  <p>{run.completed.length} / {totalSessions(program)} pass genomförda{run.finished?' · Programmet är färdigt!':''}</p>
  <progress aria-label={`Framsteg i ${program.name}`} value={run.completed.length} max={totalSessions(program)}/>
  {next&&<p>Nästa pass: {program.weeks[next.week].name}, pass {next.session+1} – {next.workout.name}</p>}
 </>;
}

export function ProgramPanel({data:d,busy,save,selected,select,requestStart}:{
 data:Data; busy:boolean; save:(change:(current:Data)=>Data)=>Promise<boolean>;
 selected?:string; select:(id:string)=>void; requestStart:(selection:WorkoutSelection)=>void;
}){
 const [error,setError]=useState('');
 const programs = [...d.programs, ...bundledPrograms.filter(program => !duplicate(d.programs, program))];
 const followed=followedPrograms(d);
 const p=programs.find(p=>p.id===(selected??followed[0]?.program.id));
 const current=followed.find(item=>item.program.id===p?.id);
 const next=current?.next;
 const viewedRuns=d.runs.filter(r=>r.programId===p?.id);
 const viewedRun=current?.run??viewedRuns.at(-1);

 async function followSelected(restart=false){
  if(!p)return;
  setError('');
  try{
   if(restart&&!confirm('Starta en ny programomgång? Tidigare framsteg och historik behålls.'))return;
   await save(current=>followProgram(current,p,restart));
  }catch(e){setError((e as Error).message);}
 }

 async function stopFollowing(item:FollowedProgram){
  setError('');
  if(!confirm(`Sluta följa ”${item.program.name}”? Dina framsteg och din historik sparas.`))return;
  try{await save(current=>unfollowProgram(current,item.run.id));}catch(e){setError((e as Error).message);}
 }

 return <>
  <div className="eyebrow">TRÄNA I DITT TEMPO</div>
  <h1>Program<span>.</span></h1>
  <p>Välj program och följ passen vecka för vecka, utan kalenderkrav.</p>
  {error&&<p role="alert" className="message error">{error}</p>}
  <section className="card">
   <h2>Välj program</h2>
   {programs.map(program=><div className="detail" key={program.id}>
    <span>{program.name}<small>{program.weeks.length} veckor · {totalSessions(program)} pass{followed.some(item=>item.program.id===program.id)?' · Följer':''}</small></span>
    <button className="secondary" aria-pressed={p?.id===program.id} aria-label={'Välj '+program.name} onClick={()=>{setError('');select(program.id);}}>Välj</button>
   </div>)}
  </section>
  {p&&<section className="card">
   <h2>{p.name}</h2>
   <p>{p.weeks.length} veckor · {totalSessions(p)} pass</p>
   {current?<><p>Följer</p><ProgramProgress {...current}/>
    {next&&<button type="button" className="primary" disabled={busy} onClick={()=>requestStart({kind:'program',runId:current.run.id,week:next.week,session:next.session})}>Starta nästa pass →</button>}
    {current.run.finished&&<button type="button" className="primary" disabled={busy} onClick={()=>followSelected(true)}>Starta ny omgång</button>}
    <button type="button" className="text-button danger" disabled={busy||d.active?.program?.runId===current.run.id} onClick={()=>stopFollowing(current)}>Sluta följa</button>
    {d.active?.program?.runId===current.run.id&&<p>Avsluta eller kasta det pågående passet innan du slutar följa programmet.</p>}
   </>:<button type="button" className="primary" disabled={busy} onClick={()=>followSelected()}>Följ program</button>}
   <button className="secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='forma-program.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Exportera program ↓</button>
   {p.weeks.map((w,wi)=>{
    const exercises=w.sessions.flatMap(session=>session.exercises);
    const sets=exercises.reduce((sum,e)=>sum+e.sets,0);
    const reps=exercises.reduce((sum,e)=>sum+(e.totalReps??0),0);
    const allRepsKnown=exercises.every(e=>e.totalReps!==null);
    return <details key={wi} open={wi===next?.week}>
    <summary>{w.name} · {w.sessions.length} pass</summary>
    <p>{sets} set · {allRepsKnown?`${reps} planerade reps totalt`:reps?`${reps} angivna reps (vissa mål saknas)`:'Inga repetitionsmål angivna'}</p>
    {w.sessions.map((s,si)=>{
     const done=viewedRun?.completed.find(c=>c.week===wi&&c.session===si);
     return <div className="program-session" key={si}>
      <h3>{done?'✓ ':wi===next?.week&&si===next.session?'Nästa: ':''}Pass {si+1} – {s.name}</h3>
      {done&&<p>Genomfört {new Date(done.date).toLocaleDateString('sv-SE')}</p>}
      {s.roundsShownInSource!==undefined&&<p>{s.roundsShownInSource} varv enligt källan · Set och reps visas som angivna.</p>}
      <ol>{s.exercises.map((e,i)=><li key={i}>{e.name}: {e.sets} set, {e.totalReps===null?'repetitionsmål saknas':e.totalReps+' reps totalt'}{e.repsPerSet?' ('+e.repsPerSet.join(' / ')+')':e.totalReps!==null&&e.totalReps%e.sets?' · fördelning ej angiven':''}</li>)}</ol>
     </div>;
    })}
   </details>;
   })}
   {viewedRun&&<p>{viewedRuns.length} sparade omgångar. Tidigare resultat finns i Historik.</p>}
  </section>}
 </>;
}
