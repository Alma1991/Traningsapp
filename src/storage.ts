export type Exercise = { id: string; name: string };
export type Template = { id: string; name: string; exercises: string[]; day: number | null };
export type SetEntry = { id: string; exerciseId: string; weight: number; reps: number };
export type Session = { id: string; name: string; started: string; finished?: string; sets: SetEntry[]; exerciseIds: string[] };
export type Data = { version: 1; exercises: Exercise[]; templates: Template[]; sessions: Session[]; active: Session | null };
export const initial: Data = {version: 1, exercises: ['Bänkpress', 'Knäböj', 'Marklyft', 'Hantelrodd', 'Axelpress'].map((name, i) => ({id: `exercise-${i}`, name})), templates: [], sessions: [], active: null};
let connection: Promise<IDBDatabase> | undefined;
function db() { return connection ??= new Promise((resolve, reject) => {
  const request = indexedDB.open('forma', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('data');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
}); }
export async function read(): Promise<Data> { const database = await db(); return new Promise((resolve, reject) => {const request = database.transaction('data').objectStore('data').get('state'); request.onsuccess = () => resolve(request.result ?? structuredClone(initial)); request.onerror = () => reject(request.error);}); }
export async function write(data: Data) { const database = await db(); return new Promise<void>((resolve, reject) => { const transaction = database.transaction('data', 'readwrite'); transaction.objectStore('data').put(data, 'state'); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); }); }
export function validate(value: unknown): value is Data {
  if (!value || typeof value !== 'object') return false;
  const d = value as Data;
  const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 300;
  if (d.version !== 1 || !Array.isArray(d.exercises) || !Array.isArray(d.templates) || !Array.isArray(d.sessions)) return false;
  if (!d.exercises.every(e => e && text(e.id) && text(e.name)) || new Set(d.exercises.map(e => e.id)).size !== d.exercises.length) return false;
  const ids = new Set(d.exercises.map(e => e.id));
  const session = (s: Session) => s && text(s.id) && text(s.name) && Number.isFinite(Date.parse(s.started)) && (s.finished === undefined || Number.isFinite(Date.parse(s.finished))) && Array.isArray(s.exerciseIds) && s.exerciseIds.every(id => ids.has(id)) && Array.isArray(s.sets) && s.sets.every(set => set && text(set.id) && ids.has(set.exerciseId) && Number.isFinite(set.weight) && set.weight >= 0 && Number.isInteger(set.reps) && set.reps > 0);
  return d.templates.every(t => t && text(t.id) && text(t.name) && Array.isArray(t.exercises) && t.exercises.every(id => ids.has(id)) && (t.day === null || Number.isInteger(t.day) && t.day >= 0 && t.day <= 6)) && d.sessions.every(s => session(s) && !!s.finished) && (d.active === null || session(d.active) && !d.active.finished);
}
