import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectSource, auditProject } from '../scripts/audit-local.mjs';

test('external requests report file and correct line',()=>{
 const result=inspectSource('src/example.ts','// comment\nfetch("https://example.com/api");');
 assert.ok(result.some(f=>f.file==='src/example.ts'&&f.line===2&&f.rule==='external-resource'));
 assert.ok(result.some(f=>f.rule==='network'));
});
test('detects network channels and dynamic fetch',()=>{
 for(const code of ['fetch(endpoint)','window.fetch(endpoint)','navigator.sendBeacon(url,data)','new WebSocket(url)','new XMLHttpRequest()','new EventSource(url)','new RTCPeerConnection()','new WebTransport(url)','self["fetch"](url)']) assert.ok(inspectSource('src/app.ts',code).some(f=>f.rule==='network'),code);
});
test('detects integrations, tracking, alternative storage and dynamic code',()=>{
 for(const code of ['import x from "firebase/app"','import "@sentry/react"','localStorage.setItem("training", data)','window["sessionStorage"]','document.cookie = data','eval(code)','new Function(code)']) assert.ok(inspectSource('src/app.ts',code).length,code);
});
test('detects remote HTML, CSS, manifest, SVG and inline scripts',()=>{
 for(const [file,code] of [['index.html','<img src="//cdn.example.com/a.png">'],['src/a.css','@import "https://fonts.example.com/font.css";'],['public/manifest.webmanifest','{"start_url":"https://example.com"}'],['public/a.svg','<image href="https://example.com/a"/>'],['index.html','<script>fetch(endpoint)</script>'],['index.html','<form action="/upload">'],['index.html','<button onclick="send()">']]) assert.ok(inspectSource(file,code).length,file);
});
test('allows local resources, IndexedDB, SVG namespace and comments',()=>{
 for(const [file,code] of [['src/a.ts','// https://example.com\nindexedDB.open("forma"); fetch("./icon.svg");'],['public/icon.svg','<svg xmlns="http://www.w3.org/2000/svg"/>'],['src/a.css','/* https://example.com */ body{background:url(/local.png)}'],['index.html','<!-- https://example.com --><script src="/src/main.tsx"></script>']]) assert.deepEqual(inspectSource(file,code),[],file);
});
test('allows reviewed same-origin worker caching but rejects unguarded worker',()=>{
 const code=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.deepEqual(inspectSource('public/sw.js',code),[]);
 assert.ok(inspectSource('public/sw.js','fetch(event.request)').length);
});
function fixture(run){const root=fs.mkdtempSync(path.join(os.tmpdir(),'forma-audit-'));try{return run(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
test('excludes dependencies, build output and developer tooling; checks runtime packages',()=>fixture(root=>{
 for(const dir of ['node_modules','dist','scripts','tests']){fs.mkdirSync(path.join(root,dir));fs.writeFileSync(path.join(root,dir,'tool.js'),'fetch("https://example.com")');}
 fs.writeFileSync(path.join(root,'vite.config.ts'),'const devServer="http://localhost:5173";');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{react:'18'},devDependencies:{vite:'6'}}));
 assert.deepEqual(auditProject(root),[]);
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({dependencies:{firebase:'1'}}));
 assert.ok(auditProject(root).some(f=>f.file==='package.json'&&f.rule==='runtime-dependency'));
}));
test('CLI succeeds for clean sources and exits nonzero on violation or invalid config',()=>fixture(root=>{
 const script=fileURLToPath(new URL('../scripts/audit-local.mjs',import.meta.url));
 const run=()=>spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
 assert.equal(run().status,0);
 fs.writeFileSync(path.join(root,'bad.ts'),'\nfetch("https://example.com");');
 const bad=run();assert.equal(bad.status,1);assert.match(bad.stderr,/bad\.ts:2/);
 fs.unlinkSync(path.join(root,'bad.ts'));fs.writeFileSync(path.join(root,'package.json'),'{');assert.equal(run().status,1);
}));
test('build runs review before TypeScript and Vite',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.match(pkg.scripts.build,/^npm run audit:local && tsc && vite build$/);
});
test('npm run build stops on a forbidden integration before later commands',()=>fixture(root=>{
 const script=fileURLToPath(new URL('../scripts/audit-local.mjs',import.meta.url));
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{
   'audit:local':`node "${script}"`,
   build:pkg.scripts.build.replace('tsc && vite build','node after-review.cjs')
 }}));
 fs.writeFileSync(path.join(root,'bad.ts'),'fetch("https://forbidden.example/api");');
 fs.writeFileSync(path.join(root,'after-review.cjs'),'require("node:fs").writeFileSync("build-ran", "yes")');
 assert.ok(process.env.npm_execpath,'Run this test using npm test');
 const result=spawnSync(process.execPath,[process.env.npm_execpath,'run','build'],{cwd:root,encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/bad\.ts:1/);
 assert.equal(fs.existsSync(path.join(root,'build-ran')),false);
}));
