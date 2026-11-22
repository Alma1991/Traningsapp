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
const fixture=()=>({id:'pplul-test',name:'Testprogram',weeks:[1,2].map(n=>({name:'Vecka '+n,sessions:[{name:'Push',exercises:[{name:'Press '+n,sets:3,totalReps:31}]},{name:'Pull',exercises:[{name:'Rodd',sets:2,totalReps:20,repsPerSet:[12,8]}]}]}))});
const data=()=>({...structuredClone(storage.initial),programs:[p.parseProgram(fixture())]});
const logged=d=>({...d,active:{...d.active,sets:[{id:crypto.randomUUID(),exerciseId:d.active.exerciseIds[0],weight:50,reps:10}]}});
test('import bevarar veckor, ordning och ojämna totalmål utan gissning',()=>{const x=p.parseProgram(fixture());assert.equal(x.weeks[1].sessions[0].exercises[0].name,'Press 2');assert.equal(x.weeks[0].sessions[0].exercises[0].totalReps,31);assert.equal(x.weeks[0].sessions[0].exercises[0].repsPerSet,undefined);assert.deepEqual(x.weeks[0].sessions[1].exercises[0].repsPerSet,[12,8]);assert.ok(p.duplicate([x],x));assert.ok(p.duplicate([x],{...x,id:'annat'}));});
test('ogiltiga program avvisas',()=>{for(const value of [null,{}, {...fixture(),weeks:[] }])assert.throws(()=>p.parseProgram(value));const x=fixture();x.weeks[0].sessions[1].exercises[0].repsPerSet=[10,9];assert.throws(()=>p.parseProgram(x),/repsPerSet/);});
test('start, återupptagning, explicit avslut och progression över veckor',()=>{let d=p.startProgram(data(),'pplul-test');for(let i=0;i<4;i++){d=p.startProgramSession(d);assert.equal(d.active.program.week,Math.floor(i/2));assert.equal(d.active.program.session,i%2);assert.equal(d.runs[0].completed.length,i);d=logged(d);const restored=storage.normalize(JSON.parse(JSON.stringify(d)));assert.ok(storage.validate(restored));assert.deepEqual(p.startProgramSession(restored).active,d.active);d=p.finishSession(restored);assert.ok(storage.validate(d));assert.equal(d.sessions.length,i+1);}assert.ok(d.runs[0].finished);assert.equal(p.nextSession(d.programs[0],d.runs[0]),null);const next=p.startProgram(d,'pplul-test');assert.equal(next.runs.length,2);assert.equal(next.sessions.length,4);assert.equal(next.runs[1].completed.length,0);});
test('programbyte bevarar historik och gamla omgångar',()=>{let d=data();d.programs.push({...fixture(),id:'andra',name:'Andra'});d=p.startProgram(d,'pplul-test');d=p.startProgramSession(d);assert.throws(()=>p.startProgram(d,'andra'));d=p.finishSession(logged(d));const old=structuredClone(d.sessions);d=p.startProgram(d,'andra');assert.deepEqual(d.sessions,old);assert.equal(d.runs[0].completed.length,1);assert.equal(d.runs[1].programId,'andra');assert.ok(storage.validate(d));});
test('äldre backup migreras och nya backupreferenser valideras',()=>{const old=structuredClone(storage.initial);delete old.programs;delete old.runs;delete old.activeRunId;assert.ok(storage.validate(old));assert.deepEqual(storage.normalize(old).programs,[]);let d=p.finishSession(logged(p.startProgramSession(p.startProgram(data(),'pplul-test'))));assert.ok(storage.validate(d));d.runs[0].completed[0].sessionId='saknas';assert.equal(storage.validate(d),false);});
test('IndexedDB skrivning och läsning bevarar pågående pass och historik',async()=>{let saved;globalThis.indexedDB={open(){const request={};queueMicrotask(()=>{request.result={transaction(){const transaction={objectStore(){return {put(value){saved=structuredClone(value);queueMicrotask(()=>transaction.oncomplete());},get(){const result={};queueMicrotask(()=>{result.result=structuredClone(saved);result.onsuccess();});return result;}}}};return transaction;}};request.onsuccess();});return request;}};let d=logged(p.startProgramSession(p.startProgram(data(),'pplul-test')));await storage.write(d);assert.deepEqual(await storage.read(),d);d=p.finishSession(d);await storage.write(d);assert.deepEqual(await storage.read(),d);});
test('projektets PPLUL konverteras utan förändrade övningar eller repetitionsmål',()=>{const source=JSON.parse(fs.readFileSync('programs/FORMA_PPLUL_6_veckor.json','utf8').replace(/^\uFEFF/,''));const result=p.parseProgram(source);assert.equal(result.weeks.length,6);assert.equal(p.totalSessions(result),30);for(const w of source.workouts){const actual=result.weeks[w.week-1].sessions[w.session-1];assert.equal(actual.name,w.focus);assert.deepEqual(actual.exercises.map(e=>[e.name,e.sets,e.totalReps]),w.exercises.map(e=>[e.name,e.sets,e.totalReps]));for(let i=0;i<w.exercises.length;i++)if(w.exercises[i].repsPerSet===null)assert.equal(actual.exercises[i].repsPerSet,undefined);}assert.ok(p.duplicate([result],p.parseProgram(source)));});
test('PPLUL: alla 30 pass följer källans setmål och bevarar befintlig historik',()=>{
 const source=JSON.parse(fs.readFileSync('programs/FORMA_PPLUL_6_veckor.json','utf8').replace(/^\uFEFF/,''));
 const program=p.parseProgram(source);
 const old={id:'tidigare-pass',name:'Tidigare träning',started:'2026-01-01T10:00:00.000Z',finished:'2026-01-01T11:00:00.000Z',exerciseIds:['exercise-0'],sets:[{id:'tidigare-set',exerciseId:'exercise-0',weight:60,reps:8}]};
 const before={...structuredClone(storage.initial),sessions:[structuredClone(old)]};
 let d=p.startProgram(before,program);
 assert.deepEqual(before.programs,[]);
 assert.deepEqual(d.programs,[program]);
 assert.ok(storage.validate(d));
 const weekly=[];
 for(let week=1;week<=6;week++){
  let sets=0,reps=0;
  assert.equal(program.weeks[week-1].sessions.length,5);
  for(let session=1;session<=5;session++){
   const original=source.workouts.find(w=>w.week===week&&w.session===session);
   d=p.startProgramSession(d);
   assert.deepEqual(d.active.program,{runId:d.activeRunId,week:week-1,session:session-1});
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
 const before=p.startProgram(data(),'pplul-test');
 const catalogProgram=p.parseProgram({...fixture(),name:'Uppdaterat program'});
 assert.ok(p.duplicate(before.programs,catalogProgram));
 const after=p.startProgram(before,catalogProgram);
 assert.deepEqual(after.programs,before.programs);
 assert.deepEqual(after.runs[0],before.runs[0]);
 assert.equal(after.runs[1].programId,catalogProgram.id);
 assert.ok(storage.validate(after));
});
test('platt import avvisar saknade och dubblerade pass samt felaktiga setmål',()=>{
 const source=JSON.parse(fs.readFileSync('programs/FORMA_PPLUL_6_veckor.json','utf8').replace(/^\uFEFF/,''));
 let bad=structuredClone(source);bad.workouts.pop();assert.throws(()=>p.parseProgram(bad),/saknas/);
 bad=structuredClone(source);bad.workouts[1]=structuredClone(bad.workouts[0]);assert.throws(()=>p.parseProgram(bad),/dubblerat/);
 bad=structuredClone(source);bad.workouts[0].exercises[0].repsPerSet=999;assert.throws(()=>p.parseProgram(bad),/repsPerSet/);
});
