import {spawn} from 'node:child_process';
const n=Number(process.argv[2]),batch='W'+(n+3);if(!Number.isInteger(n)||n<2||n>6||!process.env.AW_PYTHON)throw Error('Chapter2–6 and verified AW_PYTHON required');
const draft='.runtime/world-w'+(n+3)+'-world-draft.json',python="import runpy,json;fn=runpy.run_path('tools/config-export.py')['export_book'];data=fn('config/excel/世界.xlsx')[1];open('"+draft+"','w',encoding='utf8').write(json.dumps(data,ensure_ascii=False))";
const steps=[
 [process.execPath,['.design/open-world-m2-m4-workbooks/author-island-world.mjs',String(n),'--calibrate=docs/reviews/open-world-m2-m4/'+batch+'/field-efficiency.json']],
 [process.env.AW_PYTHON,['-X','utf8','-c',python]],
 [process.execPath,['.design/open-world-m2-m4-workbooks/author-island-quests.mjs',String(n)]],
 [process.env.AW_PYTHON,['-X','utf8','tools/config-export.py']],
 [process.execPath,['node_modules/tsx/dist/cli.mjs','tools/build-production-islands.ts']],
 [process.execPath,['node_modules/tsx/dist/cli.mjs','tools/probe-authored-island.ts',String(n),'--out=docs/reviews/open-world-m2-m4/'+batch+'/field-efficiency-tuned.json']]
];
for(const [command,args]of steps){const child=spawn(command,args,{stdio:'inherit',windowsHide:true});const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});if(code!==0){process.exitCode=code;break;}}
