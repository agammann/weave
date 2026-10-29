import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {previewCompass} from './compass.mjs';
const args=process.argv.slice(2);
if ((args.length!==4 && args.length!==6) || args[0]!=='--attest-common-base') {console.error('Usage: node compass-cli.mjs --attest-common-base BASE LEFT RIGHT [DECISIONS OUTPUT]');process.exit(2);}
try {
  const read=async p=>JSON.parse(await readFile(p,'utf8'));
  const [base,left,right]=await Promise.all(args.slice(1,4).map(read));
  const decisions=args.length===6?await read(args[4]):{};
  const result=previewCompass(base,left,right,{attestCommonBase:true,decisions});
  console.log(JSON.stringify({...result,result:result.result?'Ready to write':null},null,2));
  if(args.length===6 && result.result){
    if(args.slice(1,5).some(p=>resolve(p)===resolve(args[5]))) throw new Error('Output must not replace an input');
    await writeFile(args[5],JSON.stringify(result.result,null,2)+'\n',{flag:'wx'});
  }
  if(result.unresolved.length||result.errors.length) process.exitCode=1;
}catch(e){console.error(e.message);process.exitCode=2;}
