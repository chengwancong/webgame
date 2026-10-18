/** Few-minute GUI smoke with a real isolated store and the unchanged production
 * maps/API/client. Initial level is a declared fixture; no live player is edited. */
import {createServer as createViteServer} from 'vite';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {startDatabase,freePort} from './runtime.mjs';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {regionById} from '../packages/content/index.ts';
import {versions,type CharacterState} from '../packages/contracts/index.ts';
import configFactory from '../apps/web/vite.config.ts';
const chapter=Number(process.argv[2]),island=worldTables.islands.find(i=>i.chapter===chapter);if(!island)throw Error('An authored production island is required');
const batchAt=process.argv.indexOf('--batch'),batch=batchAt>=0?process.argv[batchAt+1]:'W'+(chapter+3);if(!/^W(?:[0-9]|10|11)$/.test(batch))throw Error('Invalid evidence batch');const out='docs/reviews/open-world-m2-m4/'+batch;await mkdir(out,{recursive:true});
const db=await startDatabase({temporary:true}),pool=new Pool({connectionString:db.dsn,max:4});await migrate(pool);const apiPort=await freePort(),webPort=await freePort(),app=createApp(pool,{testLogin:true,fieldQa:false,origins:['http://localhost:'+webPort,'http://127.0.0.1:'+webPort]});await app.listen({host:'127.0.0.1',port:apiPort});
const username='ow_island_gui',login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(login.headers['set-cookie']).split(';')[0],created=(await app.inject({method:'POST',url:'/api/character',headers:{cookie},payload:{name:island.name+'冒烟'}})).json();
const startPosition=regionById(island.region).safe;const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[created.id])).rows[0].state as CharacterState;state.level=Math.min(...worldTables.zones.filter(z=>z.region===island.region).map(z=>z.levelBand[0]))+1;state.lastRegion=island.region;state.starsea!.location={map:island.region,x:startPosition.x,y:startPosition.y};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,state.id]);
const baseConfig=(configFactory as any)({mode:'development'}),vite=await createViteServer({...baseConfig,configFile:false,mode:'development',server:{...baseConfig.server,port:webPort,proxy:{'/api':{target:'http://127.0.0.1:'+apiPort,ws:true}}}});await vite.listen();
let closed=false;const control=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping');void close();}else{res.writeHead(404);res.end();}});await new Promise<void>(r=>control.listen(0,'127.0.0.1',r));
async function close(){if(closed)return;closed=true;await vite.close();await app.close();await pool.end();const cleanup=await db.stop();await writeFile(out+'/smoke-cleanup.json',JSON.stringify(cleanup,null,2));control.close();console.log(JSON.stringify({cleanup}));}
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void close());
const report={url:'http://localhost:'+webPort+'/',stop:'http://127.0.0.1:'+String((control.address() as {port:number}).port)+'/stop',username,character:state.id,versions,region:island.region,level:state.level,scope:'Existing fixture character in real isolated PG; declared initial level only. Unchanged production map, monsters, loot, client and API; fieldQa=false. Login/map/panel/console smoke only, no gameplay sequence or natural progression claim. localhost keeps fixture cookies separate from the live127.0.0.1 preview.'};await writeFile(out+'/smoke-fixture.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
