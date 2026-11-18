import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {preview} from './weave.mjs';
import {readJson} from './merge-inputs.mjs';
const args = process.argv.slice(2);
if (args.length !== 3 && args.length !== 5) { console.error('Usage: node cli.mjs BASE LEFT RIGHT [DECISIONS OUTPUT]'); process.exit(2); }
try {
  const [base,left,right] = await Promise.all(args.slice(0,3).map(readJson));
  const decisions = args.length === 5 ? await readJson(args[3]) : {};
  const p = preview(base,left,right,decisions);
  console.log(JSON.stringify(p, null, 2));
  if (args.length === 5 && p.result) {
    if (args.slice(0,4).some(p => resolve(p) === resolve(args[4]))) throw new Error('Output must not replace an input');
    await writeFile(args[4], JSON.stringify({backup:p.result, decisionLog:p.log}, null, 2) + '\n', {flag:'wx'});
  }
  if (p.unresolved.length || p.errors.length) process.exitCode = 1;
} catch (e) { console.error(e.message); process.exitCode = 2; }
