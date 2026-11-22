import { parseProgram } from './programs';
import type { Program, Run, ProgramLink, PlannedExercise } from './programs';
export type Exercise = { id: string; name: string };
export type Template = { id: string; name: string; exercises: string[]; day: number | null };
export type SetEntry = { id: string; exerciseId: string; weight: number; reps: number; done?: boolean };
export type Session = { id: string; name: string; started: string; finished?: string; sets: SetEntry[]; exerciseIds: string[]; exerciseScope?: 'library' | 'selected'; program?: ProgramLink; planned?: PlannedExercise[] };
export type Data = { version: 1; programs: Program[]; runs: Run[]; followedRunIds: string[]; exercises: Exercise[]; templates: Template[]; sessions: Session[]; active: Session | null };
type StoredData = Omit<Data, 'followedRunIds'> & { followedRunIds?: string[]; activeRunId?: string | null };
export const initial: Data = {version: 1, programs: [], runs: [], followedRunIds: [], exercises: ['Bänkpress', 'Knäböj', 'Marklyft', 'Hantelrodd', 'Axelpress'].map((name, i) => ({id: `exercise-${i}`, name})), templates: [], sessions: [], active: null};
let connection: Promise<IDBDatabase> | undefined;
function db() { return connection ??= new Promise((resolve, reject) => {
  const request = indexedDB.open('forma', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('data');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}); }
export async function read(): Promise<Data> { const database = await db(); return new Promise((resolve, reject) => {const request = database.transaction('data').objectStore('data').get('state'); request.onsuccess = () => resolve(normalize(request.result ?? structuredClone(initial))); request.onerror = () => reject(request.error);}); }
export async function write(data: Data) { const database = await db(); return new Promise<void>((resolve, reject) => { const transaction = database.transaction('data', 'readwrite'); transaction.objectStore('data').put(data, 'state'); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); }); }
export async function update(updateState: (current: Data) => Data): Promise<Data> {
 const database = await db();
 return new Promise((resolve, reject) => {
  const transaction = database.transaction('data', 'readwrite');
  const store = transaction.objectStore('data');
  const request = store.get('state');
  let next: Data;
  let failure: unknown;
  request.onsuccess = () => {
   try {
    const current = normalize(request.result ?? structuredClone(initial));
    next = updateState(current);
    if (next !== current) store.put(next, 'state');
   } catch (error) {
    failure = error;
    transaction.abort();
   }
  };
  transaction.oncomplete = () => resolve(next);
  transaction.onabort = () => reject(failure ?? transaction.error);
 });
}
export function validate(value: unknown): value is StoredData {
  if (!value || typeof value !== 'object') return false;
  const d = value as StoredData;
  const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 300;
  if (!validatePrograms(d)) return false;
  if (d.version !== 1 || !Array.isArray(d.exercises) || !Array.isArray(d.templates) || !Array.isArray(d.sessions)) return false;
  if (!d.exercises.every(e => e && text(e.id) && text(e.name)) || new Set(d.exercises.map(e => e.id)).size !== d.exercises.length) return false;
  const ids = new Set(d.exercises.map(e => e.id));
  const session = (s: Session) => s && text(s.id) && text(s.name) && Number.isFinite(Date.parse(s.started)) && (s.finished === undefined || Number.isFinite(Date.parse(s.finished))) && (s.exerciseScope === undefined || s.exerciseScope === 'library' || s.exerciseScope === 'selected') && Array.isArray(s.exerciseIds) && s.exerciseIds.every(id => ids.has(id)) && Array.isArray(s.sets) && s.sets.every(set => set && text(set.id) && ids.has(set.exerciseId) && Number.isFinite(set.weight) && set.weight >= 0 && Number.isInteger(set.reps) && set.reps > 0);
  return d.templates.every(t => t && text(t.id) && text(t.name) && Array.isArray(t.exercises) && t.exercises.every(id => ids.has(id)) && (t.day === null || Number.isInteger(t.day) && t.day >= 0 && t.day <= 6)) && d.sessions.every(s => session(s) && !!s.finished) && (d.active === null || session(d.active) && !d.active.finished);
}

export function normalize(value: StoredData): Data {
 const {activeRunId, followedRunIds, ...data}=value;
 return {...data, programs:data.programs ?? [], runs:data.runs ?? [], followedRunIds:followedRunIds ?? (activeRunId == null ? [] : [activeRunId])};
}
function validatePrograms(raw: StoredData): boolean {
 try {
 const d=normalize(raw);
 if(!Array.isArray(d.programs) || !Array.isArray(d.runs)) return false;
 for(const p of d.programs) parseProgram(p);
 if(new Set(d.programs.map(p=>p.id)).size!==d.programs.length || new Set(d.runs.map(r=>r.id)).size!==d.runs.length)return false;
 const validDate=(v: string)=>typeof v==='string' && Number.isFinite(Date.parse(v));
 for(const r of d.runs){
 const p=d.programs.find(p=>p.id===r.programId);
 if(!p || typeof r.id!=='string' || !r.id || !validDate(r.started) || !Array.isArray(r.completed)) return false;
 const keys=new Set<string>();
 for(const c of r.completed){
 const key=c.week+':'+c.session;
 const s=d.sessions.find(s=>s.id===c.sessionId);
 if(!Number.isInteger(c.week)||!Number.isInteger(c.session)||!p.weeks[c.week]?.sessions[c.session]||keys.has(key)||!validDate(c.date)||!s||s.finished!==c.date||s.program?.runId!==r.id||s.program.week!==c.week||s.program.session!==c.session)return false;
 keys.add(key);
 }
 const total=p.weeks.reduce((n,w)=>n+w.sessions.length,0);
 if(r.finished!==undefined && (!validDate(r.finished)||r.completed.length!==total))return false;
 }
 if(raw.followedRunIds!==undefined&&!Array.isArray(raw.followedRunIds))return false;
 const followed=d.followedRunIds.map(id=>d.runs.find(r=>r.id===id));
 if(followed.some(run=>!run)||new Set(followed.map(run=>run?.programId)).size!==followed.length)return false;
 for(const s of [...d.sessions,...(d.active?[d.active]:[])]){
 if(s.sets.some(x=>x.done!==undefined&&typeof x.done!=='boolean'))return false;
 if(s.program){
 const r=d.runs.find(r=>r.id===s.program!.runId),p=d.programs.find(p=>p.id===r?.programId);
 if(!r||!p||!Number.isInteger(s.program.week)||!Number.isInteger(s.program.session)||!p.weeks[s.program.week]?.sessions[s.program.session])return false;
 if(!s.finished && (!d.followedRunIds.includes(r.id)||r.completed.some(c=>c.week===s.program!.week&&c.session===s.program!.session)))return false;
 if(s.finished&&!r.completed.some(c=>c.sessionId===s.id))return false;
 }
 if(s.planned){parseProgram({id:'validation',name:'validation',weeks:[{name:'validation',sessions:[{name:'validation',exercises:s.planned}]}]});if(s.planned.some(e=>!s.exerciseIds.includes(e.exerciseId)))return false;}
 }
 return true;
 }catch{return false;}
}
