import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
globalThis.crypto ??= webcrypto;
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const programURL=url(compile('src/programs.ts'));
const p=await import(programURL);
const storage=await import(url(compile('src/storage.ts').replace("'./programs'",JSON.stringify(programURL))));
const workouts=await import(url(compile('src/workouts.ts').replace("'./programs'",JSON.stringify(programURL))));
const fixture=()=>({id:'pplul-test',name:'Testprogram',weeks:[1,2].map(n=>({name:'Vecka '+n,sessions:[{name:'Push',exercises:[{name:'Press '+n,sets:3,totalReps:31}]},{name:'Pull',exercises:[{name:'Rodd',sets:2,totalReps:20,repsPerSet:[12,8]}]}]}))});
const data=()=>({...structuredClone(storage.initial),programs:[p.parseProgram(fixture())]});
const startLatest=(d,position)=>p.startProgramSession(d,d.followedRunIds.at(-1),position);
const logged=d=>({...d,active:{...d.active,sets:[{id:crypto.randomUUID(),exerciseId:d.active.exerciseIds[0],weight:50,reps:10}]}});
test('PPLUL och Hybrid kan följas parallellt och behåller separata framsteg',()=>{
 const load=name=>p.parseProgram(JSON.parse(fs.readFileSync('programs/'+name,'utf8').replace(/^\uFEFF/,'')));
 const pplul=load('FORMA_PPLUL_6_veckor.json');
 const hybrid=load('FORMA_Hybrid_6_veckor.json');
 const first=p.followProgram(structuredClone(storage.initial),pplul);
 const pplulId=first.followedRunIds[0];
 const withActive=p.startProgramSession(first,pplulId);
 const both=p.followProgram(withActive,hybrid);
 const hybridId=both.followedRunIds[1];
 assert.equal(both.active.id,withActive.active.id);
 assert.strictEqual(p.followProgram(both,pplul),both);
 assert.strictEqual(p.followProgram(both,hybrid,true),both);
 assert.throws(()=>p.unfollowProgram(both,pplulId),/pågående/);
 const afterPplul=p.finishSession(logged(both));
 const afterHybrid=p.finishSession(logged(p.startProgramSession(afterPplul,hybridId,{week:0,session:1})));
 const progress=p.followedPrograms(afterHybrid);
 assert.deepEqual(progress.map(({run,next})=>[run.completed.length,next.week,next.session]),[[1,0,1],[1,0,0]]);
 assert.ok(storage.validate(afterHybrid));
 assert.equal(storage.validate({...afterHybrid,followedRunIds:[pplulId,pplulId]}),false);
 const stopped=p.unfollowProgram(afterHybrid,pplulId);
 assert.deepEqual(stopped.followedRunIds,[hybridId]);
 assert.deepEqual(stopped.sessions,afterHybrid.sessions);
 assert.deepEqual(stopped.runs,afterHybrid.runs);
 assert.throws(()=>p.startProgramSession(stopped,pplulId),/följa/);
 const resumed=p.followProgram(stopped,pplul);
 assert.deepEqual(p.followedPrograms(resumed).map(({run})=>run.completed.length),[1,1]);
 assert.ok(storage.validate(resumed));
});
test('ett äldre aktivt program migreras med progression och pågående pass',()=>{
 const followed=p.followProgram(data(),'pplul-test');
 const progressed=p.finishSession(logged(startLatest(followed)));
 const {followedRunIds,...state}=logged(startLatest(progressed));
 const legacy={...state,activeRunId:followedRunIds[0]};
 assert.ok(storage.validate(legacy));
 const migrated=storage.normalize(legacy);
 assert.deepEqual(migrated.followedRunIds,followedRunIds);
 assert.deepEqual(migrated.active,legacy.active);
 assert.deepEqual(migrated.runs,legacy.runs);
 assert.deepEqual(migrated.sessions,legacy.sessions);
 assert.equal(p.finishSession(migrated).runs[0].completed.length,2);
});
test('förhandsvisning skapar inga pass och bekräftelse skyddar pågående pass',()=>{
 const template={id:'sparat',name:'Styrka',day:null,exercises:['exercise-0']};
 const state=workouts.saveTemplate(p.followProgram(data(),'pplul-test'),template);
 const snapshot=structuredClone(state);
 const selections=[
  [{kind:'free'},'Fritt träningspass','Fritt träningspass'],
  [{kind:'saved',templateId:template.id},'Styrka','Styrka'],
  [{kind:'program',runId:state.followedRunIds[0],week:0,session:0},'Push · Testprogram, Vecka 1, pass 1','Push'],
 ];
 for(const [selection,label,sessionName] of selections){
  const name=workouts.workoutStartName(state,selection);
  assert.equal(name,label);
  assert.deepEqual(state,snapshot);
  assert.equal(state.active,null);
  assert.throws(()=>workouts.confirmWorkoutStart(state,selection,'Gammalt namn'),/ändrats/);
  const started=workouts.confirmWorkoutStart(state,selection,name);
  assert.equal(started.active.name,sessionName);
  assert.ok(storage.validate(started));
  assert.strictEqual(workouts.confirmWorkoutStart(started,{kind:'free'},'Fritt träningspass'),started);
 }
});
test('ett valfritt återstående programpass registreras på rätt vecka och kan inte startas igen',()=>{
 const before=p.followProgram(data(),'pplul-test');
 const position={week:1,session:0};
 const started=startLatest(before,position);
 assert.deepEqual(started.active.program,{runId:before.followedRunIds[0],...position});
 assert.equal(started.active.planned[0].name,'Press 2');
 assert.ok(storage.validate(started));
 const finished=p.finishSession(logged(started));
 assert.ok(storage.validate(finished));
 assert.equal(p.nextSession(finished.programs[0],finished.runs[0]).week,0);
 assert.throws(()=>startLatest(finished,position),/inte tillgängligt/);
 assert.throws(()=>startLatest(finished,{week:99,session:0}),/inte tillgängligt/);
});
test('skapa och redigera sparat pass bevarar id, tidigare historik och pågående pass',()=>{
 const history=p.finishSession(logged(startLatest(p.followProgram(data(),'pplul-test'))));
 const [first,second]=history.exercises;
 const template={id:'sparat',name:'Styrka',day:1,exercises:[first.id]};
 const created=workouts.saveTemplate(history,template);
 assert.deepEqual(history.templates,[]);
 const active=workouts.startWorkout(created,template);
 const edited=workouts.saveTemplate(active,{...template,name:'Styrka B',day:4,exercises:[second.id]});
 assert.deepEqual(edited.templates,[{...template,name:'Styrka B',day:4,exercises:[second.id]}]);
 assert.deepEqual(edited.sessions,history.sessions);
 assert.deepEqual(edited.runs,history.runs);
 assert.deepEqual(edited.active,active.active);
 assert.equal(edited.active.name,'Styrka');
 assert.deepEqual(edited.active.exerciseIds,[first.id]);
 assert.strictEqual(workouts.startWorkout(edited),edited);
 assert.ok(storage.validate(edited));
});
test('sparade pass visar valda övningar och extra övningar sparas bara i det aktiva passet',()=>{
 const before=structuredClone(storage.initial);
 const [first,second,third]=before.exercises;
 const template={id:'sparat',name:'Fritt träningspass',day:null,exercises:[third.id,first.id]};
 const started=workouts.startWorkout(workouts.saveTemplate(before,template),template);
 assert.deepEqual(workouts.workoutExercises(started.active,started.exercises).choices,[third,first]);
 assert.ok(workouts.workoutExercises(started.active,started.exercises).extras.includes(second));
 const withExtra=workouts.addWorkoutExercise(started,second.id);
 const restored=storage.normalize(JSON.parse(JSON.stringify(withExtra)));
 assert.ok(storage.validate(restored));
 assert.deepEqual(workouts.workoutExercises(restored.active,restored.exercises).choices,[third,first,second]);
 assert.deepEqual(restored.templates,[template]);
 assert.strictEqual(workouts.addWorkoutExercise(withExtra,second.id),withExtra);
 assert.strictEqual(workouts.addWorkoutExercise(withExtra,'saknas'),withExtra);
 const free=workouts.startWorkout(before);
 assert.deepEqual(free.active.exerciseIds,[]);
 assert.deepEqual(workouts.workoutExercises(free.active,free.exercises),{choices:before.exercises,extras:[]});
 const {exerciseScope,...legacy}=started.active;
 assert.deepEqual(workouts.workoutExercises({...legacy,name:'Äldre sparat pass'},before.exercises).choices,[third,first]);
 assert.deepEqual(workouts.workoutExercises({...legacy,exerciseIds:[first.id]},before.exercises).choices,before.exercises);
});
test('import bevarar veckor, ordning och ojämna totalmål utan gissning',()=>{const x=p.parseProgram(fixture());assert.equal(x.weeks[1].sessions[0].exercises[0].name,'Press 2');assert.equal(x.weeks[0].sessions[0].exercises[0].totalReps,31);assert.equal(x.weeks[0].sessions[0].exercises[0].repsPerSet,undefined);assert.deepEqual(x.weeks[0].sessions[1].exercises[0].repsPerSet,[12,8]);assert.ok(p.duplicate([x],x));assert.ok(p.duplicate([x],{...x,id:'annat'}));});
test('ogiltiga program avvisas',()=>{for(const value of [null,{}, {...fixture(),weeks:[] }])assert.throws(()=>p.parseProgram(value));const x=fixture();x.weeks[0].sessions[1].exercises[0].repsPerSet=[10,9];assert.throws(()=>p.parseProgram(x),/repsPerSet/);});
test('start, återupptagning, explicit avslut och progression över veckor',()=>{let d=p.followProgram(data(),'pplul-test');for(let i=0;i<4;i++){d=startLatest(d);assert.equal(d.active.program.week,Math.floor(i/2));assert.equal(d.active.program.session,i%2);assert.equal(d.runs[0].completed.length,i);d=logged(d);const restored=storage.normalize(JSON.parse(JSON.stringify(d)));assert.ok(storage.validate(restored));assert.deepEqual(startLatest(restored).active,d.active);d=p.finishSession(restored);assert.ok(storage.validate(d));assert.equal(d.sessions.length,i+1);}assert.ok(d.runs[0].finished);assert.equal(p.nextSession(d.programs[0],d.runs[0]),null);const next=p.followProgram(d,'pplul-test',true);assert.equal(next.runs.length,2);assert.equal(next.sessions.length,4);assert.equal(next.runs[1].completed.length,0);});
test('äldre backup migreras och nya backupreferenser valideras',()=>{const old=structuredClone(storage.initial);delete old.programs;delete old.runs;delete old.followedRunIds[0];assert.ok(storage.validate(old));assert.deepEqual(storage.normalize(old).programs,[]);let d=p.finishSession(logged(startLatest(p.followProgram(data(),'pplul-test'))));assert.ok(storage.validate(d));d.runs[0].completed[0].sessionId='saknas';assert.equal(storage.validate(d),false);});
test('IndexedDB sparar en bekräftad start och lämnar ett redan pågående pass intakt',async()=>{
 let saved;
 let writes=0;
 globalThis.indexedDB={open(){
  const request={};
  queueMicrotask(()=>{
   request.result={transaction(){
    const transaction={objectStore(){
     return {
      put(value){
       saved=structuredClone(value);
       writes++;
       queueMicrotask(()=>transaction.oncomplete());
      },
      get(){
       const result={};
       const before=writes;
       queueMicrotask(()=>{
        result.result=structuredClone(saved);
        result.onsuccess();
        if(writes===before)transaction.oncomplete?.();
       });
       return result;
      },
     };
    }};
    return transaction;
   }};
   request.onsuccess();
  });
  return request;
 }};
 const original=p.followProgram(data(),'pplul-test');
 await storage.write(original);
 const selection={kind:'program',runId:original.followedRunIds[0],week:0,session:0};
 const name=workouts.workoutStartName(original,selection);
 assert.equal((await storage.read()).active,null);
 assert.equal(writes,1);
 const started=await storage.update(current=>workouts.confirmWorkoutStart(current,selection,name));
 const blocked=await storage.update(current=>workouts.confirmWorkoutStart(current,{kind:'free'},'Fritt träningspass'));
 assert.deepEqual(blocked,started);
 assert.deepEqual(await storage.read(),started);
 assert.equal(writes,2);
 const finished=p.finishSession(logged(started));
 await storage.write(finished);
 assert.deepEqual(await storage.read(),finished);
});
test('projektets PPLUL konverteras utan förändrade övningar eller repetitionsmål',()=>{const source=JSON.parse(fs.readFileSync('programs/FORMA_PPLUL_6_veckor.json','utf8').replace(/^\uFEFF/,''));const result=p.parseProgram(source);assert.equal(result.weeks.length,6);assert.equal(p.totalSessions(result),30);for(const w of source.workouts){const actual=result.weeks[w.week-1].sessions[w.session-1];assert.equal(actual.name,w.focus);assert.deepEqual(actual.exercises.map(e=>[e.name,e.sets,e.totalReps]),w.exercises.map(e=>[e.name,e.sets,e.totalReps]));for(let i=0;i<w.exercises.length;i++)if(w.exercises[i].repsPerSet===null)assert.equal(actual.exercises[i].repsPerSet,undefined);}assert.ok(p.duplicate([result],p.parseProgram(source)));});
test('PPLUL: alla 30 pass följer källans setmål och bevarar befintlig historik',()=>{
 const source=JSON.parse(fs.readFileSync('programs/FORMA_PPLUL_6_veckor.json','utf8').replace(/^\uFEFF/,''));
 const program=p.parseProgram(source);
 const old={id:'tidigare-pass',name:'Tidigare träning',started:'2026-01-01T10:00:00.000Z',finished:'2026-01-01T11:00:00.000Z',exerciseIds:['exercise-0'],sets:[{id:'tidigare-set',exerciseId:'exercise-0',weight:60,reps:8}]};
 const before={...structuredClone(storage.initial),sessions:[structuredClone(old)]};
 let d=p.followProgram(before,program);
 assert.deepEqual(before.programs,[]);
 assert.deepEqual(d.programs,[program]);
 assert.ok(storage.validate(d));
 const weekly=[];
 for(let week=1;week<=6;week++){
  let sets=0,reps=0;
  assert.equal(program.weeks[week-1].sessions.length,5);
  for(let session=1;session<=5;session++){
   const original=source.workouts.find(w=>w.week===week&&w.session===session);
   d=startLatest(d);
   assert.deepEqual(d.active.program,{runId:d.followedRunIds[0],week:week-1,session:session-1});
   assert.equal(d.active.name,original.focus);
   assert.deepEqual(d.active.planned.map(({exerciseId,...e})=>e),original.exercises.map(e=>({name:e.name,sets:e.sets,totalReps:e.totalReps,...(e.repsPerSet==null?{}:{repsPerSet:Array.isArray(e.repsPerSet)?e.repsPerSet:Array(e.sets).fill(e.repsPerSet)})})));
   for(const e of d.active.planned){sets+=e.sets;reps+=e.totalReps;}
   const count=d.runs[0].completed.length;
   d=logged(d);
   d=storage.normalize(JSON.parse(JSON.stringify(d)));
   assert.equal(d.runs[0].completed.length,count);
   assert.ok(storage.validate(d));
   d=p.finishSession(d);
   assert.ok(storage.validate(d));
   assert.deepEqual(d.sessions[0],old);
  }
  weekly.push([sets,reps]);
 }
 assert.deepEqual(weekly,[[97,715],[99,727],[100,732],[100,732],[101,734],[102,746]]);
 assert.equal(d.sessions.length,31);
 assert.equal(d.runs[0].completed.length,30);
 assert.ok(d.runs[0].finished);
 assert.equal(p.nextSession(program,d.runs[0]),null);
});
test('katalogprogram med sparat id ersätter inte definitionen eller tidigare omgångar',()=>{
 const before=p.followProgram(data(),'pplul-test');
 const catalogProgram=p.parseProgram({...fixture(),name:'Uppdaterat program'});
 assert.ok(p.duplicate(before.programs,catalogProgram));
 const after=p.followProgram(before,catalogProgram);
 assert.deepEqual(after.programs,before.programs);
 assert.deepEqual(after.runs[0],before.runs[0]);
 assert.strictEqual(after,before);
 assert.ok(storage.validate(after));
});
test('platt import avvisar saknade och dubblerade pass samt felaktiga setmål',()=>{
 const source=JSON.parse(fs.readFileSync('programs/FORMA_PPLUL_6_veckor.json','utf8').replace(/^\uFEFF/,''));
 let bad=structuredClone(source);bad.workouts.pop();assert.throws(()=>p.parseProgram(bad),/saknas/);
 bad=structuredClone(source);bad.workouts[1]=structuredClone(bad.workouts[0]);assert.throws(()=>p.parseProgram(bad),/dubblerat/);
 bad=structuredClone(source);bad.workouts[0].exercises[0].repsPerSet=999;assert.throws(()=>p.parseProgram(bad),/repsPerSet/);
});
test('FORMA Hybrid läser in och loggar alla 24 pass med källans set och repetitionsmål',()=>{
 const source=JSON.parse(fs.readFileSync('programs/FORMA_Hybrid_6_veckor.json','utf8').replace(/^\uFEFF/,''));
 const hybrid=p.parseProgram(source);
 assert.equal(hybrid.name,source.name);
 assert.equal(hybrid.weeks.length,6);
 assert.equal(p.totalSessions(hybrid),24);

 const before=p.finishSession(logged(startLatest(p.followProgram(data(),'pplul-test'))));
 let state=p.followProgram(before,hybrid);
 for(const [week,definition] of hybrid.weeks.entries()){
  assert.equal(definition.sessions.length,4);
  for(const [session,workout] of definition.sessions.entries()){
   const original=source.workouts.find(w=>w.week===week+1&&w.session===session+1);
   const expectedExercises=original.exercises.map(({repsPerSet,...exercise})=>({
    ...exercise,
    ...(repsPerSet==null?{}:{repsPerSet:Array(exercise.sets).fill(repsPerSet)}),
   }));
   assert.equal(workout.roundsShownInSource,original.roundsShownInSource);
   assert.equal(workout.name,original.focus);
   assert.deepEqual(workout.exercises,expectedExercises);
   state=startLatest(state);
   assert.deepEqual(state.active.program,{runId:state.followedRunIds.at(-1),week,session});
   assert.deepEqual(state.active.planned.map(({exerciseId,...exercise})=>exercise),expectedExercises);
   state=storage.normalize(JSON.parse(JSON.stringify(logged(state))));
   assert.ok(storage.validate(state));
   state=p.finishSession(state);
   assert.ok(storage.validate(state));
  }
 }
 assert.deepEqual(state.programs[0],before.programs[0]);
 assert.deepEqual(state.runs[0],before.runs[0]);
 assert.deepEqual(state.sessions[0],before.sessions[0]);
 assert.equal(state.runs[1].completed.length,24);
 assert.ok(state.runs[1].finished);
 assert.deepEqual(p.parseProgram(state.programs[1]),hybrid);
 const invalid=structuredClone(source);
 const missingGoal=invalid.workouts[0].exercises.find(e=>e.totalReps===null);
 missingGoal.repsPerSet=1;
 assert.throws(()=>p.parseProgram(invalid),/repsPerSet/);
});
