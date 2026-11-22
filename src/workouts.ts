import type { Data, Exercise, Session, Template } from './storage';
import { startProgramSession } from './programs';
import type { ProgramLink } from './programs';

const freeWorkoutName = 'Fritt träningspass';
export type WorkoutSelection = {kind:'free'} | {kind:'saved'; templateId:string} | ({kind:'program'} & ProgramLink);

export function workoutStartName(data: Data, selection: WorkoutSelection): string | undefined {
 if (selection.kind === 'free') return freeWorkoutName;
 if (selection.kind === 'saved') return data.templates.find(t => t.id === selection.templateId)?.name;
 const run = data.runs.find(r => r.id === selection.runId && data.followedRunIds.includes(r.id));
 const program = data.programs.find(p => p.id === run?.programId);
 const week = program?.weeks[selection.week];
 const session = week?.sessions[selection.session];
 if (!session || run?.completed.some(c => c.week === selection.week && c.session === selection.session)) return;
 return `${session.name} · ${program!.name}, ${week!.name}, pass ${selection.session+1}`;
}

export function confirmWorkoutStart(data: Data, selection: WorkoutSelection, displayedName: string): Data {
 if (data.active) return data;
 if (workoutStartName(data, selection) !== displayedName) throw new Error('Passet har ändrats. Välj det på nytt.');
 if (selection.kind === 'program') {
  const {runId, week, session} = selection;
  return startProgramSession(data,runId,{week,session});
 }
 return startWorkout(data,selection.kind === 'saved' ? data.templates.find(t => t.id === selection.templateId) : undefined);
}

export function startWorkout(data: Data, template?: Template): Data {
 if (data.active) return data;
 return {
  ...data,
  active: {
   id: crypto.randomUUID(),
   name: template?.name ?? freeWorkoutName,
   started: new Date().toISOString(),
   sets: [],
   exerciseIds: [...(template?.exercises ?? [])],
   exerciseScope: template ? 'selected' : 'library',
  },
 };
}

export function saveTemplate(data: Data, template: Template): Data {
 const templates = data.templates.some(t => t.id === template.id)
  ? data.templates.map(t => t.id === template.id ? template : t)
  : [...data.templates, template];
 return { ...data, templates };
}

export function workoutExercises(session: Session, library: Exercise[]) {
 const scope = session.exerciseScope ?? (session.program || session.name !== freeWorkoutName ? 'selected' : 'library');
 if (scope === 'library') return { choices: library, extras: [] };
 const selected = new Set([...session.exerciseIds, ...session.sets.map(set => set.exerciseId)]);
 const byId = new Map(library.map(exercise => [exercise.id, exercise]));
 return {
  choices: [...selected].map(id => byId.get(id)).filter(exercise => exercise !== undefined),
  extras: library.filter(exercise => !selected.has(exercise.id)),
 };
}

export function addWorkoutExercise(data: Data, exerciseId: string): Data {
 const active = data.active;
 if (!active || !workoutExercises(active, data.exercises).extras.some(exercise => exercise.id === exerciseId)) {
  return data;
 }
 return { ...data, active: { ...active, exerciseIds: [...active.exerciseIds, exerciseId] } };
}
