/** 可选离线转码。仅在ffmpeg存在时运行；清单仍交由build.py写入。 */
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),probe=spawnSync('ffmpeg',['-version'],{stdio:'ignore'});
if(probe.error||probe.status!==0){console.log('未找到ffmpeg：保留WAV，不修改清单。');process.exit(0);}
const manifest=JSON.parse(readFileSync(resolve(root,'apps/web/src/audio/sample-manifest.json'),'utf8'));
for(const [key,stages]of Object.entries(manifest))for(const entry of Object.values(stages))for(const file of entry.files){if(!file.endsWith('.wav'))continue;const input=resolve(root,'apps/web/public','.'+file),rate=/^(amb|music|source)\//.test(key)?'128k':'96k';for(const [ext,codec]of [['opus','libopus'],['m4a','aac']]){const output=input.replace(/\.wav$/,'.'+ext);if(existsSync(output))continue;const result=spawnSync('ffmpeg',['-nostdin','-v','error','-i',input,'-c:a',codec,'-b:a',rate,output],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}}
const build=spawnSync(process.env.AW_PYTHON??'python',['-X','utf8','tools/audio/build.py','--register-transcodes'],{cwd:root,stdio:'inherit'});process.exit(build.status??1);
