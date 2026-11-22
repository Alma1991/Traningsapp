import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Data, Session, Template, read, validate, write, normalize, update } from './storage';
import './style.css';
import { ProgramPanel, ProgramProgress } from './ProgramPanel';
import { finishSession, followedPrograms } from './programs';
import { addWorkoutExercise, confirmWorkoutStart, saveTemplate, workoutExercises, workoutStartName } from './workouts';
import type { WorkoutSelection } from './workouts';
import { WorkoutDialog } from './WorkoutDialog';

const tabs = [{id:'home',icon:'◉',name:'Översikt'},{id:'programs',icon:'▤',name:'Program'},{id:'plans',icon:'▦',name:'Mina pass'},{id:'history',icon:'◷',name:'Historik'},{id:'progress',icon:'↗',name:'Utveckling'},{id:'settings',icon:'⚙',name:'Inställningar'}];
const days = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag'];
const date = (s: string) => new Date(s).toLocaleDateString('sv-SE',{day:'numeric',month:'short'});
const volume = (s: Session) => s.sets.reduce((v,x)=>v+x.weight*x.reps,0);
function App(){
 const [data,setData] = useState<Data>(); const [page,setPage] = useState('home'); const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const [busy,setBusy] = useState(false); const [ready,setReady] = useState(false);
 const [newName,setNewName] = useState(''); const [planName,setPlanName] = useState(''); const [chosen,setChosen] = useState<string[]>([]); const [day,setDay] = useState(''); const [exercise,setExercise] = useState(''); const [weight,setWeight] = useState(''); const [reps,setReps] = useState(''); const [expanded,setExpanded] = useState<string>(); const file = useRef<HTMLInputElement>(null);
 const [startMenu,setStartMenu] = useState<'options' | 'saved' | 'program' | 'blocked' | {selection:WorkoutSelection; name:string}>();
 const [selectedProgram,setSelectedProgram] = useState<string>();
 const [editing,setEditing] = useState<string>();
 const [review,setReview] = useState<Template>();
 const [addingExtra,setAddingExtra] = useState(false);
 const [extra,setExtra] = useState('');
 const planInput = useRef<HTMLInputElement>(null);
 const saving = useRef(false);
 useEffect(()=>{read().then(d=>{setData(d);setReady(true)}).catch(()=>setError('Lokal lagring kunde inte öppnas. Kontrollera webbläsarens inställningar och ladda om.'));},[]);
 async function save(change: Data | ((current:Data)=>Data)){
  if(saving.current)return false;
  saving.current=true;setBusy(true);setError('');
  try{
   if(typeof change==='function')setData(await update(change));
   else{await write(change);setData(change);}
   return true;
  }catch(error){
   if(typeof change==='function'&&error instanceof Error&&!(error instanceof DOMException))throw error;
   setError('Det gick inte att spara. Kontrollera ledigt utrymme och försök igen.');
   return false;
  }finally{saving.current=false;setBusy(false);}
 }
 if(!data) return <main className="loading"><h1>FORMA<span>.</span></h1><p role="status">{error || 'Öppnar ditt träningsutrymme…'}</p></main>;
 const d = data;
 const exerciseName = (id: string)=>d.exercises.find(e=>e.id===id)?.name ?? 'Okänd övning';
 const active = d.active;
 const followed = followedPrograms(d);
 const confirmation = typeof startMenu === 'object' ? startMenu : undefined;
 const { choices, extras } = active ? workoutExercises(active, d.exercises) : { choices: [], extras: [] };
 const selectedExercise = choices.some(e => e.id === exercise) ? exercise : '';
 const weekStart = new Date();weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-(weekStart.getDay()+6)%7);
 const weekCount = d.sessions.filter(s=>new Date(s.finished!)>=weekStart).length;
 const records = d.exercises.map(e=>({ ...e, best: Math.max(0,...d.sessions.flatMap(s=>s.sets.filter(x=>x.exerciseId===e.id).map(x=>x.weight))) })).filter(e=>d.sessions.some(s=>s.sets.some(x=>x.exerciseId===e.id)));
 const nextPlan = [...d.templates].sort((a,b)=> ((a.day??new Date().getDay())-new Date().getDay()+7)%7-((b.day??new Date().getDay())-new Date().getDay()+7)%7)[0];
 function openWorkout(session: Session | null) {
  setExercise(session?.exerciseIds[0] ?? '');
  setAddingExtra(false);
  setExtra('');
  setStartMenu(undefined);
  setPage('workout');
 }
 function chooseWorkout() {
  setError('');
  setStartMenu(active?'blocked':'options');
 }
 function requestStart(selection:WorkoutSelection) {
  if(saving.current)return;
  setError('');
  if(active){setStartMenu('blocked');return;}
  const name=workoutStartName(d,selection);
  if(name)setStartMenu({selection,name});
 }
 async function startConfirmed() {
  if (!confirmation||saving.current) return;
  saving.current=true;
  setBusy(true);
  setError('');
  try {
   let blocked=false;
   const next=await update(current=>{
    blocked=!!current.active;
    return confirmWorkoutStart(current,confirmation.selection,confirmation.name);
   });
   setData(next);
   if(blocked){setStartMenu('blocked');return;}
   setWeight('');
   setReps('');
   openWorkout(next.active);
  } catch (error) {
   setError(error instanceof Error ? error.message : 'Det gick inte att starta passet. Försök igen.');
  } finally {
   saving.current=false;
   setBusy(false);
  }
 }
 function editTemplate(template?: Template) {
  setEditing(template?.id);
  setPlanName(template?.name ?? '');
  setChosen(template ? [...new Set(template.exercises)] : []);
  setDay(template?.day == null ? '' : String(template.day));
  if (template) {
   planInput.current?.scrollIntoView({block: 'center'});
   planInput.current?.focus({preventScroll: true});
  }
 }
 async function addExtra(e: React.FormEvent) {
  e.preventDefault();
  const next = addWorkoutExercise(d, extra);
  if (next === d) return;
  if (await save(next)) {
   setExercise(extra);
   setExtra('');
   setAddingExtra(false);
  }
 }
 async function addSet(e: React.FormEvent){e.preventDefault();if(!active || !selectedExercise || weight.trim()==='' || reps.trim()==='' || !Number.isFinite(+weight) || +weight<0 || !Number.isInteger(+reps) || +reps<1)return;await save({...d,active:{...active,exerciseIds:[...new Set([...active.exerciseIds,selectedExercise])],sets:[...active.sets,{id:crypto.randomUUID(),exerciseId:selectedExercise,weight:+weight,reps:+reps}]}});}
 function sessionCard(s: Session){return <article className="card session" key={s.id}><button className="session-toggle" onClick={()=>setExpanded(expanded===s.id?undefined:s.id)} aria-expanded={expanded===s.id}><span className="session-icon">▥</span><span><b>{s.name}</b><small>{date(s.finished!)} · {s.sets.length} set · {volume(s).toLocaleString('sv-SE')} kg volym</small></span><span className="arrow">{expanded===s.id?'−':'↗'}</span></button>{expanded===s.id&&<div className="details">{s.sets.map((x,i)=><div className="detail" key={x.id}><span>{i+1}. {exerciseName(x.exerciseId)}</span><b>{x.weight} kg × {x.reps}</b></div>)}</div>}</article>}
 return <div className="shell"><aside className="sidebar"><a className="logo" href="#" onClick={e=>{e.preventDefault();setPage('home')}}>FORMA<span>.</span></a><div className="side-caption">DITT TRÄNINGSUTRYMME</div><nav aria-label="Huvudnavigation">{tabs.map(t=><button key={t.id} className={page===t.id?'nav-item selected':'nav-item'} onClick={()=>setPage(t.id)} aria-current={page===t.id?'page':undefined}><span>{t.icon}</span>{t.name}{t.id==='plans'&&<small>{d.templates.length}</small>}</button>)}</nav><div className="local-badge"><i/> Bara på din enhet<small>Inget konto. Bara din träning.</small></div></aside><div className="workspace"><header><span className="breadcrumb">Ditt utrymme <span>/ {tabs.find(t=>t.id===page)?.name ?? 'Pågående pass'}</span></span><div className="header-meta"><span className="status"><i/>{busy?'Sparar…':ready?'Sparas lokalt':'Läser…'}</span><span className="app-version">v{__APP_VERSION__}</span></div></header><main><div role="alert">{error&&<div className="message error">{error}</div>}</div><div role="status">{notice&&<div className="message">{notice}<button aria-label="Stäng meddelande" onClick={()=>setNotice('')}>×</button></div>}</div>
 {page==='home'&&<><section className="card">
  <h2>Mina träningsprogram</h2>
  {followed.length===0?<><p>Du följer inga träningsprogram ännu.</p><button className="secondary" onClick={()=>setPage('programs')}>Välj program →</button></>:
   <div className="followed-programs">{followed.map(item=><article key={item.program.id}>
    <h3>{item.program.name}</h3>
    <ProgramProgress {...item}/>
    <button className="secondary" aria-label={'Öppna '+item.program.name} onClick={()=>{setSelectedProgram(item.program.id);setPage('programs');}}>Öppna program →</button>
   </article>)}</div>}
 </section><div className="title-row"><div><div className="eyebrow">DIN RESA, DITT TEMPO</div><h1>Dags att bli starkare<span>.</span></h1><p>Lite mer fokus. Ett set till. Du gör jobbet.</p></div><span className="date-tag">{new Date().toLocaleDateString('sv-SE',{weekday:'long',day:'numeric',month:'long'})}</span></div><div className="dashboard"><section className="hero"><div className="hero-top"><span className="tag">{active?'PÅGÅENDE PASS':nextPlan?'DITT NÄSTA PASS':'ALLT BÖRJAR HÄR'}</span><span>↗</span></div><div className="hero-body"><div><h2>{active?.name ?? nextPlan?.name ?? 'Ditt nästa kapitel'}</h2><p>{active?`${active.sets.length} set registrerade · Fortsätt där du var`:nextPlan?`${nextPlan.exercises.length} övningar · ${nextPlan.day===null?'Träna när du vill':days[nextPlan.day]}`:'Skapa din rutin eller börja med ett fritt pass.'}</p><button className="dark-button" disabled={busy} onClick={()=>active?openWorkout(active):chooseWorkout()}>{active?'Fortsätt passet':'Starta ett pass'} <span>→</span></button></div><div className="hero-art" aria-hidden="true"><div className="plate p1"/><div className="plate p2"/><div className="bar"/><div className="plate p3"/><div className="plate p4"/></div></div><div className="hero-footer"><span>DIN TRÄNING. PÅ DINA VILLKOR.</span><span>01 / ∞</span></div></section><section className="card week-card"><div className="eyebrow">DEN HÄR VECKAN</div><div className="big-number">{weekCount}<span> pass</span></div><div className="week-days">{[1,2,3,4,5,6,0].map(n=>{const wd=new Date(weekStart);wd.setDate(wd.getDate()+(n+6)%7);const done=d.sessions.some(s=>new Date(s.finished!).toDateString()===wd.toDateString());return <div key={n} className={done?'done':n===new Date().getDay()?'today':''}><span>{days[n].slice(0,1)}</span><b>{done?'✓':wd.getDate()}</b></div>})}</div><p>{weekCount?'Varje pass räknas. Fortsätt i ditt tempo.':'En ny vecka. Plats för nya framsteg.'}</p></section></div><div className="stat-grid"><div className="card stat"><span>↗</span><div><small>GENOMFÖRDA PASS</small><strong>{d.sessions.length}<em> totalt</em></strong></div></div><div className="card stat"><span>✧</span><div><small>ÖVNINGAR MED REKORD</small><strong>{records.length}<em> övningar</em></strong></div></div><div className="card stat"><span>▥</span><div><small>TOTAL TRÄNINGSVOLYM</small><strong>{d.sessions.reduce((v,s)=>v+volume(s),0).toLocaleString('sv-SE')}<em> kg</em></strong></div></div></div><div className="section-title"><h2>Senaste passen</h2><button className="text-button" onClick={()=>setPage('history')}>Visa historik ↗</button></div>{d.sessions.length?d.sessions.slice().reverse().slice(0,3).map(sessionCard):<div className="card empty"><span className="empty-icon">◷</span><h3>Här börjar din träningshistoria</h3><p>Ditt första avslutade pass dyker upp här.<br/>En bra dag att börja är idag.</p><button className="text-button" disabled={busy} onClick={chooseWorkout}>Starta ditt första pass →</button></div>}<div className="quiet-note"><span>◈</span> Din träningsdata stannar på din enhet. Säkerhetskopiera under Inställningar.</div></>}
 {page==='programs'&&<ProgramPanel data={d} busy={busy} save={save} selected={selectedProgram} select={setSelectedProgram} requestStart={requestStart}/>}
 {page==='plans'&&<>
  <div className="eyebrow">BYGG DIN RUTIN</div><h1>Mina pass<span>.</span></h1>
  <p>Egna övningar, egna pass, ditt veckoschema.</p>
  <div className="two-columns">
   <section className="card">
    <h2>{editing?'Redigera träningspass':'Skapa träningspass'}</h2>
    <form onSubmit={e=>{
     e.preventDefault();
     if (!planName.trim() || !chosen.length) return;
     setError('');
     setReview({id:editing??crypto.randomUUID(),name:planName.trim(),exercises:chosen,day:day===''?null:+day});
    }}>
     <label>Namn<input ref={planInput} required maxLength={100} value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Till exempel Överkropp A"/></label>
     <label>Dag i schemat<select value={day} onChange={e=>setDay(e.target.value)}><option value="">Ingen bestämd dag</option>{[1,2,3,4,5,6,0].map(n=><option key={n} value={n}>{days[n]}</option>)}</select></label>
     <fieldset><legend>Välj övningar</legend>{d.exercises.map(e=><label className="checkbox" key={e.id}><input type="checkbox" checked={chosen.includes(e.id)} onChange={()=>setChosen(chosen.includes(e.id)?chosen.filter(id=>id!==e.id):[...chosen,e.id])}/>{e.name}</label>)}</fieldset>
     <button className="primary" disabled={busy||!planName.trim()||!chosen.length}>Granska träningspass</button>
     {editing&&<button type="button" className="text-button" onClick={()=>editTemplate()}>Avbryt redigering</button>}
    </form>
   </section>
   <section>
    <div className="card"><h2>Lägg till egen övning</h2><form onSubmit={async e=>{e.preventDefault();if(!newName.trim())return;if(await save({...d,exercises:[...d.exercises,{id:crypto.randomUUID(),name:newName.trim()}]}))setNewName('');}}><label>Övningens namn<input required maxLength={100} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Till exempel Latsdrag"/></label><button className="secondary" disabled={busy}>Lägg till övning +</button></form></div>
    <h2>Sparade pass</h2>
    {!d.templates.length&&<p>Du har inga sparade pass ännu.</p>}
    {d.templates.map(t=><article className="card" key={t.id}>
     <small className="eyebrow">{t.day===null?'VALFRI DAG':days[t.day]}</small>
     <h3>{t.name}</h3>
     {t.exercises.length?<ul className="workout-exercises">{t.exercises.map((id,i)=><li key={i}>{exerciseName(id)}</li>)}</ul>:<p>Inga valda övningar.</p>}
     <button className="primary" disabled={busy} onClick={()=>requestStart({kind:'saved',templateId:t.id})}>Starta pass →</button>
     <button className="secondary" disabled={busy} onClick={()=>editTemplate(t)}>Redigera pass</button>
     <button className="text-button danger" disabled={busy} onClick={async ()=>{
      if(confirm('Ta bort passet ”'+t.name+'”? Din historik behålls.')&&await save({...d,templates:d.templates.filter(x=>x.id!==t.id)})&&editing===t.id)editTemplate();
     }}>Ta bort pass</button>
    </article>)}
   </section>
  </div>
 </>}
 {page==='workout'&&active&&<><div className="eyebrow">ETT SET I TAGET</div><h1>{active.name}<span>.</span></h1><p>Startat {new Date(active.started).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})} · {active.sets.length} registrerade set</p><div className="two-columns"><section className="card"><h2>Registrera set</h2>{active.planned&&<div>{active.planned.map((e,i)=><p key={i}><b>{i+1}. {e.name}</b><br/>{e.sets} set · {e.totalReps===null?'Repetitionsmål saknas':e.totalReps+' reps totalt'}{e.totalReps===null?'':e.repsPerSet?' · '+e.repsPerSet.join(' / ')+' reps per set':e.totalReps%e.sets===0?' · '+e.totalReps/e.sets+' reps per set':' · Ingen fördelning angiven'}<br/>{active.sets.filter(x=>x.exerciseId===e.exerciseId).length} set klara</p>)}</div>}<form onSubmit={addSet}><label>Övning<select required value={selectedExercise} onChange={e=>setExercise(e.target.value)}><option value="" disabled>Välj övning</option>{choices.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>{(()=>{if(!selectedExercise)return null;const prev=d.sessions.slice().reverse().flatMap(s=>s.sets).find(s=>s.exerciseId===selectedExercise);return prev?<p>Senast: {prev.weight} kg × {prev.reps} reps</p>:<p>Din första registrering för den här övningen.</p>})()}<div className="input-row"><label>Vikt (kg)<input required type="number" inputMode="decimal" min="0" step="0.25" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="0"/></label><label>Repetitioner<input required type="number" inputMode="numeric" min="1" step="1" value={reps} onChange={e=>setReps(e.target.value)} placeholder="10"/></label></div><button className="primary" disabled={busy||!selectedExercise}>Markera set klart ✓</button></form>
 {extras.length>0&&(addingExtra?<form onSubmit={addExtra}>
  <label>Extra övning<select required value={extra} onChange={e=>setExtra(e.target.value)}>
   <option value="" disabled>Välj en extra övning</option>
   {extras.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
  </select></label>
  <button className="secondary" disabled={busy||!extra}>Lägg till i passet</button>
  <button type="button" className="text-button" disabled={busy} onClick={()=>{setExtra('');setAddingExtra(false);}}>Avbryt</button>
 </form>:<button className="secondary" disabled={busy} onClick={()=>setAddingExtra(true)}>Lägg till extra övning</button>)}
 </section><section className="card"><h2>Registrerade set</h2>{active.sets.length?active.sets.map((x,i)=><div className="detail" key={x.id}><span>{i+1}. {exerciseName(x.exerciseId)}<small>{x.weight} kg × {x.reps} reps</small></span><button className="icon-button" aria-label={`Ta bort set ${i+1}`} disabled={busy} onClick={()=>void save({...d,active:{...active,sets:active.sets.filter(s=>s.id!==x.id)}})}>×</button></div>):<p>Dina set visas här när du sparar dem.</p>}<button className="primary" disabled={busy||!active.sets.length} onClick={async()=>{if(await save(finishSession(d))){setPage(active.program?'programs':'history');setNotice('Snyggt jobbat! Passet har sparats.');}}}>Avsluta och spara passet →</button><button className="text-button danger" disabled={busy} onClick={async()=>{if(confirm('Kasta det pågående passet? Registrerade set i detta pass tas bort.')&&await save({...d,active:null}))setPage('home');}}>Kasta pågående pass</button></section></div></>}
 {page==='history'&&<><div className="eyebrow">VARJE PASS RÄKNAS</div><h1>Din träningshistoria<span>.</span></h1><p>{d.sessions.length} genomförda pass. Tryck på ett pass för att se alla set.</p>{d.sessions.length?d.sessions.slice().reverse().map(sessionCard):<div className="card empty"><h2>Första sidan är oskriven.</h2><p>Avsluta ett träningspass så visas det här.</p><button className="primary" disabled={busy} onClick={chooseWorkout}>Starta ett pass →</button></div>}</>}
 {page==='progress'&&<><div className="eyebrow">SE VAD DU BYGGER</div><h1>Dina framsteg<span>.</span></h1><p>Personliga rekord visar den tyngsta registrerade vikten i avslutade pass.</p>{!records.length?<div className="card empty"><h2>Styrka växer med tiden.</h2><p>Logga och avsluta ditt första pass för att följa utvecklingen.</p></div>:<div className="two-columns">{records.map(e=>{const points=d.sessions.filter(s=>s.sets.some(x=>x.exerciseId===e.id)).slice(-8).map(s=>({date:date(s.finished!),value:Math.max(...s.sets.filter(x=>x.exerciseId===e.id).map(x=>x.weight))}));return <section className="card" key={e.id}><div className="row"><h2>{e.name}</h2><span className="record-badge">REKORD</span></div><strong className="record">{e.best}<small> kg</small></strong><p>Tyngsta vikt per pass · senaste {points.length} passen</p><div className="chart" role="img" aria-label={points.map(p=>`${p.date}: ${p.value} kg`).join(', ')}>{points.map((p,i)=><div key={i}><span>{p.value}</span><i style={{height:`${Math.max(4,p.value/Math.max(1,e.best)*120)}px`}}/><small>{p.date}</small></div>)}</div></section>})}</div>}</>}
 {page==='settings'&&<><div className="eyebrow">DIN DATA, DIN KONTROLL</div><h1>Inställningar<span>.</span></h1><div className="two-columns"><section className="card"><h2>Säkerhetskopiera</h2><p>Exportera all träningsdata som JSON. Spara filen på en säker plats — data kan försvinna om webbläsaren rensas eller enheten byts.</p><button className="primary" disabled={busy} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`forma-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Exportera träningsdata ↓</button><h2>Återställ från fil</h2><p>Import ersätter all nuvarande data, inklusive ett eventuellt pågående pass. Exportera först om du vill behålla en kopia.</p><input className="file-input" ref={file} type="file" accept=".json,application/json" aria-label="Välj säkerhetskopia" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>20*1024*1024)throw new Error('Filen är för stor (max 20 MB).');const next:unknown=JSON.parse(await f.text());if(!validate(next))throw new Error('Filen är inte en giltig FORMA-säkerhetskopia.');if(confirm('Ersätt all lokal träningsdata med säkerhetskopian?')&&await save(normalize(next))){setExercise('');setNotice('Säkerhetskopian har återställts.');}}catch(err){setError(err instanceof Error?err.message:'Filen kunde inte läsas.');}}}/><button className="secondary" disabled={busy} onClick={()=>file.current?.click()}>Importera säkerhetskopia ↑</button></section><section className="card"><h2>Helt på din enhet</h2><p>Träningsdata lagras i IndexedDB i den här webbläsaren. Appen använder inga externa API:er, konton eller molntjänster.</p><div className="divider"/><h2>Förberedd för offline</h2><p>Produktionsversionen registrerar en service worker som sparar appens filer för offlineanvändning efter första besöket. Använd HTTPS eller localhost.</p><p>Manifest och ikon finns på plats. Android-installation behöver verifieras på en fysisk enhet och kompletteras med PNG-ikoner innan slutlig PWA-leverans.</p></section></div></>}
 {startMenu&&<WorkoutDialog
  title={confirmation?'Bekräfta passstart':startMenu==='blocked'?'Ett pass pågår redan':startMenu==='saved'?'Välj ett sparat pass':startMenu==='program'?'Välj ett programpass':'Starta ett pass'}
  close={()=>{setError('');setStartMenu(undefined);}} busy={busy} focusCancel={!!confirmation}>
  {error&&<p className="message error" role="alert">{error}</p>}
  {confirmation&&<>
   <p>Vill du starta <strong>{confirmation.name}</strong>?</p>
   <button className="primary" disabled={busy} onClick={startConfirmed}>Ja, starta pass</button>
  </>}
  {startMenu==='blocked'&&active&&<>
   <p><strong>{active.name}</strong> pågår. Avsluta eller kasta det passet innan du startar ett nytt.</p>
   <button className="primary" onClick={()=>openWorkout(active)}>Fortsätt pågående pass</button>
  </>}
  {startMenu==='options'&&<>
   <button className="primary" disabled={busy} onClick={()=>requestStart({kind:'free'})}>Fritt träningspass</button>
   <p>Börja med ett tomt pass och välj övningar under träningen.</p>
   {d.templates.length>0
    ? <button className="secondary" onClick={()=>setStartMenu('saved')}>Mina sparade pass</button>
    : <p>Du har inga sparade pass ännu. Skapa ett under Mina pass.</p>}
   {followed.some(item=>item.next)
    ? <button className="secondary" onClick={()=>setStartMenu('program')}>Mina träningsprogram</button>
    : <p>{followed.length?'Alla pass i dina följda träningsprogram är genomförda.':'Du följer inga träningsprogram ännu. Välj ett under Program.'}</p>}
  </>}
  {startMenu==='saved'&&d.templates.map(t=><button className="secondary" key={t.id} disabled={busy} onClick={()=>requestStart({kind:'saved',templateId:t.id})}>{t.name}</button>)}
  {startMenu==='program'&&followed.filter(item=>item.next).map(({program,run,next})=><section key={run.id}>
   <h3>{program.name}</h3>
   {program.weeks.map((week,wi)=>week.sessions.map((session,si)=>{
    if(run.completed.some(c=>c.week===wi&&c.session===si))return null;
    const recommended=wi===next?.week&&si===next.session;
    return <button className="secondary" key={wi+'-'+si} disabled={busy} onClick={()=>requestStart({kind:'program',runId:run.id,week:wi,session:si})}>
     {recommended?'Nästa pass · ':''}{week.name}, pass {si+1} · {session.name}
    </button>;
   }))}
  </section>)}
  {(startMenu==='saved'||startMenu==='program')&&<button className="secondary" disabled={busy} onClick={()=>{setError('');setStartMenu('options');}}>Tillbaka</button>}
 </WorkoutDialog>}
 {review&&<WorkoutDialog title="Bekräfta träningspass" close={()=>setReview(undefined)} busy={busy}>
  {error&&<p className="message error" role="alert">{error}</p>}
  <h3>{review.name}</h3>
  <p>{review.day===null?'Valfri dag':days[review.day]}</p>
  <ul className="workout-exercises">{review.exercises.map(id=><li key={id}>{exerciseName(id)}</li>)}</ul>
  <button className="primary" disabled={busy} onClick={async ()=>{
   if(await save(saveTemplate(d,review))){
    setReview(undefined);
    editTemplate();
    setNotice('Träningspasset har sparats.');
   }
  }}>Bekräfta och spara</button>
 </WorkoutDialog>}
 </main><footer>FORMA<span>.</span> <span>Bygg din styrka. Behåll din frihet.</span></footer></div>{active&&page!=='workout'&&<button className="resume" onClick={()=>openWorkout(active)}>● Fortsätt pågående pass →</button>}<nav className="mobile-nav" aria-label="Mobilnavigation">{tabs.map(t=><button key={t.id} aria-current={page===t.id?'page':undefined} className={page===t.id?'selected':''} onClick={()=>setPage(t.id)}><span>{t.icon}</span>{t.id==='settings'?'Mer':t.name}</button>)}</nav></div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
if(import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load',()=>{navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>console.warn('Offline-cache kunde inte aktiveras.'));});
