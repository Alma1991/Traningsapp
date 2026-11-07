import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const excluded = new Set(['node_modules', 'dist', '.git', 'scripts', 'tests', 'coverage']);
const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.html', '.css', '.svg', '.json', '.webmanifest']);
const external = /(?:https?:|wss?:|ftp:|\/\/)[^\s"'<>]+/i;
const forbiddenPackages = /(?:firebase|supabase|amplify|auth0|clerk|next-auth|sentry|analytics|telemetry|posthog|mixpanel|segment|hotjar|datadog|appwrite|pocketbase|mongoose|mongodb|prisma)/i;
const allowedDependencies = new Set(['react', 'react-dom']);

/** Conservative, offline source review. Findings always contain a 1-based line. */
export function inspectSource(file, source) {
  const findings = [];
  const add = (offset, rule, message) => {
    const line = source.slice(0, offset).split('\n').length;
    if (!findings.some(f => f.line === line && f.rule === rule)) findings.push({file, line, rule, message});
  };
  const checkString = (value, offset) => {
    // SVG namespace identifiers do not cause network requests.
    const cleaned = value.replace(/http:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink)/g, '');
    if (external.test(cleaned)) add(offset, 'external-resource', 'Adresse eller resurs utanför appen är förbjuden.');
  };
  if (/\.[cm]?[jt]sx?$/.test(file)) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, /tsx$/.test(file) ? ts.ScriptKind.TSX : /jsx$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.TS);
    const name = node => ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text : ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : '';
    const localAsset = node => ts.isStringLiteral(node) && /^(?:\.\.?\/|\/(?!\/))/.test(node.text) && !node.text.includes('://');
    const isWorker = file.replaceAll('\\', '/') === 'public/sw.js';
    // Only the reviewed same-origin Request cache pattern is exempted.
    const guardedWorker = isWorker && /new URL\(event\.request\.url\)\.origin !== self\.location\.origin\) return/.test(source);
    function visit(node) {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) checkString(node.text, node.getStart(tree));
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const module = node.moduleSpecifier;
        if (module && ts.isStringLiteral(module) && forbiddenPackages.test(module.text)) add(node.getStart(tree), 'integration', `Förbjuden integration: ${module.text}`);
      }
      if (ts.isIdentifier(node) && /^(?:localStorage|sessionStorage)$/.test(node.text)) add(node.getStart(tree), 'storage', 'Appdata ska lagras i IndexedDB.');
      if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression) && /^(localStorage|sessionStorage|cookie)$/.test(node.argumentExpression.text)) add(node.getStart(tree), 'storage', 'Alternativ webbläsarlagring måste ersättas med IndexedDB.');
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'cookie') add(node.getStart(tree), 'storage', 'Cookies är inte tillåten datalagring i appen.');
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const called = name(node.expression);
        if (['XMLHttpRequest','WebSocket','EventSource','sendBeacon','RTCPeerConnection','WebTransport','importScripts'].includes(called)) add(node.getStart(tree), 'network', `Nätverksintegration kräver borttagning: ${called}.`);
        if (called === 'fetch') {
          const arg = node.arguments?.[0];
          const cacheRequest = guardedWorker && arg && arg.getText(tree) === 'event.request';
          if (!arg || (!localAsset(arg) && !cacheRequest)) add(node.getStart(tree), 'network', 'fetch till dynamisk eller extern adress är förbjudet; endast lokala resurssökvägar tillåts.');
        }
        if (['eval','Function'].includes(called)) add(node.getStart(tree), 'dynamic-code', 'Dynamisk kod kan kringgå lokal granskning.');
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  } else {
    // Preserve offsets while removing comments so reported lines stay accurate.
    const text = source.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (const match of text.matchAll(/(?:https?:|wss?:|ftp:|\/\/)[^\s"'<>)}]+/gi)) checkString(match[0], match.index);
    if (/\.html$/.test(file)) {
      for (const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
        const start = match.index + match[0].indexOf('>') + 1;
        const padding = source.slice(0,start).replace(/[^\n]/g,' ');
        findings.push(...inspectSource(file + '.js', padding + match[1]).map(f=>({...f,file})));
      }
      for (const match of text.matchAll(/\bon\w+\s*=\s*(["'])([\s\S]*?)\1/gi)) add(match.index, 'inline-handler', 'Inline-händelser kräver manuell granskning; använd appens typade händelsehantering.');
      for (const match of text.matchAll(/<form\b[^>]*\baction\s*=/gi)) add(match.index, 'form-action', 'Formulär får inte skicka data till en server.');
    }
  }
  return findings;
}

export function auditProject(root) {
  const findings = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(directory,entry.name);
      const relative = path.relative(root,absolute).replaceAll('\\','/');
      if (entry.isDirectory()) {if(!excluded.has(entry.name)) walk(absolute);continue;}
      if (!extensions.has(path.extname(entry.name)) || ['package-lock.json','package.json','tsconfig.json','vite.config.ts'].includes(relative)) continue;
      findings.push(...inspectSource(relative,fs.readFileSync(absolute,'utf8')));
    }
  }
  walk(root);
  const packagePath = path.join(root,'package.json');
  if (fs.existsSync(packagePath)) {
    const source = fs.readFileSync(packagePath,'utf8');
    const pkg = JSON.parse(source);
    for (const dependency of Object.keys(pkg.dependencies ?? {})) {
      if (!allowedDependencies.has(dependency)) findings.push({file:'package.json',line:source.slice(0,source.indexOf(`"${dependency}"`)).split('\n').length,rule:'runtime-dependency',message:`Ej granskat körningsberoende: ${dependency}. Granska lokalt och uppdatera tillåtelselistan först efter godkännande.`});
    }
    for (const dependency of Object.keys(pkg.devDependencies ?? {})) {
      if(forbiddenPackages.test(dependency)) findings.push({file:'package.json',line:source.slice(0,source.indexOf(`"${dependency}"`)).split('\n').length,rule:'integration',message:`Misstänkt integrationspaket: ${dependency}.`});
    }
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const findings = auditProject(process.cwd());
    for (const f of findings) console.error(`${f.file}:${f.line} [${f.rule}] ${f.message}`);
    if(findings.length) {console.error(`Lokal granskning stoppade bygget: ${findings.length} misstänkta överträdelser.`);process.exitCode=1;}
    else console.log('Lokal granskning godkänd. Inga misstänkta regelöverträdelser hittades.');
  } catch(error) {console.error('Lokal granskning misslyckades:',error.message);process.exitCode=1;}
}
