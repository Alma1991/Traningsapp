import type { Data, Session } from './storage';
export type ProgramExercise = { name: string; sets: number; totalReps: number; repsPerSet?: number[] };
export type Program = { id: string; name: string; weeks: { name: string; sessions: { name: string; exercises: ProgramExercise[] }[] }[] };
export type Run = { id: string; programId: string; started: string; completed: { week: number; session: number; sessionId: string; date: string }[]; finished?: string };
export type ProgramLink = { runId: string; week: number; session: number };
export type PlannedExercise = ProgramExercise & { exerciseId: string };
const fail = (path: string): never => { throw new Error(`Ogiltigt program: ${path}.`); };
export function parseProgram(value: unknown): Program {
 const source = value as {name?:string; id?:string; weeks?:number; sessionsPerWeek?:number; workouts?:{week:number;session:number;focus:string;exercises:{name:string;sets:number;totalReps:number;repsPerSet?:number|number[]|null}[]}[]};
 if(source && Array.isArray(source.workouts)){
 if(!Number.isInteger(source.weeks)||source.weeks!<1||source.weeks!>104||!Number.isInteger(source.sessionsPerWeek)||source.sessionsPerWeek!<1||source.sessionsPerWeek!>100)fail('ange giltiga weeks och sessionsPerWeek');
 const keys=new Set<string>();
 for(const w of source.workouts){if(!w||!Number.isInteger(w.week)||w.week<1||w.week>source.weeks!||!Number.isInteger(w.session)||w.session<1||w.session>source.sessionsPerWeek!||keys.has(w.week+':'+w.session)||!Array.isArray(w.exercises))fail('ogiltigt eller dubblerat veckonummer/passnummer');keys.add(w.week+':'+w.session);}
 if(keys.size!==source.weeks!*source.sessionsPerWeek!)fail('ett eller flera pass saknas');
 return parseProgram({id:source.id??'import-'+source.name,name:source.name,weeks:Array.from({length:source.weeks!},(_,i)=>({name:'Vecka '+(i+1),sessions:Array.from({length:source.sessionsPerWeek!},(_,j)=>{const w=source.workouts!.find(w=>w.week===i+1&&w.session===j+1)!;return {name:w.focus,exercises:w.exercises.map(e=>({...e,...(e.repsPerSet==null?{repsPerSet:undefined}:typeof e.repsPerSet==='number'?{repsPerSet:Array.from({length:Number.isInteger(e.sets)&&e.sets>0&&e.sets<=100?e.sets:0},()=>e.repsPerSet)}:{})}))};})}))});
 }
 const v = value as Program;
 const text = (x: unknown) => typeof x === 'string' && x.trim().length > 0 && x.length <= 200;
 const count = (x: unknown) => Number.isInteger(x) && Number(x) > 0 && Number(x) <= 10000;
 if (!v || !text(v.id) || !text(v.name) || !Array.isArray(v.weeks) || !v.weeks.length || v.weeks.length > 104) fail('ange id, namn och 1–104 veckor');
 return {id:v.id.trim(),name:v.name.trim(),weeks:v.weeks.map((w,i)=>{
  if (!w || !text(w.name) || !Array.isArray(w.sessions) || !w.sessions.length || w.sessions.length > 100) fail(`vecka ${i+1} behöver namn och pass`);
  return {name:w.name.trim(),sessions:w.sessions.map((s,j)=>{
   if (!s || !text(s.name) || !Array.isArray(s.exercises) || !s.exercises.length || s.exercises.length > 100) fail(`vecka ${i+1}, pass ${j+1} behöver namn och övningar`);
   return {name:s.name.trim(),exercises:s.exercises.map((e,k)=>{
    const path=`vecka ${i+1}, pass ${j+1}, övning ${k+1}`;
    if (!e || !text(e.name) || !count(e.sets) || e.sets > 100 || !count(e.totalReps)) fail(`${path}: ange namn, antal set och totalt antal repetitioner`);
    if (e.repsPerSet !== undefined && (!Array.isArray(e.repsPerSet) || e.repsPerSet.length !== e.sets || !e.repsPerSet.every(count) || e.repsPerSet.reduce((a,b)=>a+b,0)!==e.totalReps)) fail(`${path}: repsPerSet måste matcha antal set och totalReps`);
    return {name:e.name.trim(),sets:e.sets,totalReps:e.totalReps,...(e.repsPerSet ? {repsPerSet:[...e.repsPerSet]} : {})};
   })};
  })};
 })};
}
export const totalSessions = (p: Program) => p.weeks.reduce((n,w)=>n+w.sessions.length,0);
export function duplicate(programs: Program[], p: Program) {
 const content = (x: Program) => JSON.stringify({name:x.name,weeks:x.weeks}).toLocaleLowerCase();
 return programs.some(x=>x.id===p.id || content(x)===content(p));
}
export function nextSession(p: Program, run: Run) {
 for (let week=0;week<p.weeks.length;week++) for(let session=0;session<p.weeks[week].sessions.length;session++) if(!run.completed.some(c=>c.week===week && c.session===session)) return {week,session,workout:p.weeks[week].sessions[session]};
 return null;
}
export function startProgram(d: Data, programId: string): Data {
 if(d.active) throw new Error('Avsluta eller kasta pågående pass innan du byter program.');
 if(!d.programs.some(p=>p.id===programId)) throw new Error('Programmet finns inte.');
 const run: Run={id:crypto.randomUUID(),programId,started:new Date().toISOString(),completed:[]};
 return {...d,runs:[...d.runs,run],activeRunId:run.id};
}
export function startProgramSession(d: Data): Data {
 if(d.active) return d;
 const run=d.runs.find(r=>r.id===d.activeRunId), p=d.programs.find(p=>p.id===run?.programId);
 if(!run || !p) throw new Error('Välj ett program först.');
 const next=nextSession(p,run); if(!next) throw new Error('Programmet är färdigt. Starta en ny omgång.');
 const exercises=[...d.exercises];
 const planned=next.workout.exercises.map(e=>{let found=exercises.find(x=>x.name.toLocaleLowerCase()===e.name.toLocaleLowerCase());if(!found){found={id:crypto.randomUUID(),name:e.name};exercises.push(found);}return {...e,exerciseId:found.id};});
 const active: Session={id:crypto.randomUUID(),name:next.workout.name,started:new Date().toISOString(),sets:[],exerciseIds:planned.map(e=>e.exerciseId),planned,program:{runId:run.id,week:next.week,session:next.session}};
 return {...d,exercises,active};
}
export function finishSession(d: Data, date=new Date().toISOString()): Data {
 if(!d.active || !d.active.sets.length) throw new Error('Registrera minst ett set först.');
 const s={...d.active,finished:date};
 const runs=d.runs.map(r=>{
  if(r.id!==s.program?.runId) return r;
  if(r.completed.some(c=>c.week===s.program!.week && c.session===s.program!.session)) throw new Error('Passet är redan genomfört.');
  const updated={...r,completed:[...r.completed,{week:s.program.week,session:s.program.session,sessionId:s.id,date}]};
  const p=d.programs.find(p=>p.id===r.programId)!;
  return nextSession(p,updated) ? updated : {...updated,finished:date};
 });
 return {...d,active:null,sessions:[...d.sessions,s],runs};
}
