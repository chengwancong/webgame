import serveStatic from '@fastify/static';
import {createApp} from '../apps/api/src/app.ts';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {regionById} from '../packages/content/index.ts';
import {createInterface} from 'node:readline';
import {registerApi} from './runtime.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
// A controlled, still real field permit: a durable normal target at a legal
// distance lets the visible test inspect status icons before the target dies.
const arena=regionById('meadow'),target=arena.spawns.find(s=>!s.boss&&!s.elite);
if(!target)throw Error('Visible arena normal target missing');
target.hp=200000;target.attack=0;target.x=arena.safe.x+1.8;target.y=arena.safe.y;
const pool=poolFor(process.env.AW_DATABASE_URL);await migrate(pool);
const app=createApp(pool,{testLogin:true,campaign:'legacy',origins:[process.env.AW_ORIGINS]});
await app.register(serveStatic,{root:process.env.AW_STATIC_ROOT,prefix:'/'});
await app.listen({host:'127.0.0.1',port:Number(process.env.AW_API_PORT)});
if(process.env.AW_VISIBLE_WORK){await registerApi({work:process.env.AW_VISIBLE_WORK},{pid:process.pid});const path=join(process.env.AW_VISIBLE_WORK,'owner.json'),owner=JSON.parse(await readFile(path,'utf8'));if(owner.tool!=='open-world-runtime'||!owner.temporary)throw Error('Visible QA ownership mismatch');owner.owner=process.pid;await writeFile(path,JSON.stringify(owner));}
console.log('Visible QA API ready');
let closing=false;async function close(){if(closing)return;closing=true;await app.close();await pool.end();process.exit(0);}
process.on('message',message=>{if(message==='stop')void close();});process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
createInterface({input:process.stdin}).on('line',line=>{if(line.trim()==='stop')void close();});
