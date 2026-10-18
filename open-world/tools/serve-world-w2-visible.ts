/** Disposable real API + Vite public modules for the visible in-app browser.
 * Does not launch a browser, edit production content or use the live database. */
import {createServer as createViteServer} from 'vite';
import {createServer as createControlServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {startDatabase,freePort} from './runtime.mjs';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {generateProductionIsland} from './build-production-islands.ts';
import {registerProducedWorld,type ProducedWorld} from '../packages/content/open-world/index.ts';
import {twoZoneIsland,catalogues} from '../tests/fixtures/production-island.ts';
import configFactory from '../apps/web/vite.config.ts';
import {versions} from '../packages/contracts/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
const out='docs/reviews/open-world-m2-m4/W2/visible';await mkdir(out,{recursive:true});
const table=twoZoneIsland(),region=table.islands[0].region,allArt=catalogues.flatMap(c=>c.assets),art=(category:string)=>allArt.find(a=>a.category===category)!.id;
const template={...structuredClone(monsterContent.templates.find(t=>t.curve==='starsea'&&t.kind==='melee')!),id:'visible-controlled-monster',role:'swarm' as const,base:{hp:10,attack:0,armor:0},skills:[]};monsterContent.templates.push(template);table.camps[0].pack=[{template:template.id,rank:'normal',count:3}];
table.chests.push({_row:4,id:'visible-chest',region,zone:table.zones[0].id,x:122,y:256,loot:'field-chest',resource:art('chest'),openResource:allArt.find(a=>a.category==='chest'&&a.id.includes('open'))!.id});
for(const [i,kind]of ['waves','defend','horde'].entries())table.events.push({_row:4+i,id:'visible-event-'+kind,region,zone:table.zones[0].id,x:132+i*12,y:256,name:'实机'+kind,kind:kind as 'waves'|'defend'|'horde',definition:'visible-event-'+kind,resource:art('event-prop'),markerResource:art('world-state'),startEffect:allArt.find(a=>a.category==='event-effect'&&a.id.endsWith('start'))!.id,successEffect:allArt.find(a=>a.category==='event-effect'&&a.id.endsWith('success'))!.id,failureEffect:allArt.find(a=>a.category==='event-effect'&&a.id.endsWith('failure'))!.id,radius:48,cooldownSeconds:600,durationSeconds:kind==='defend'?12:90,waveIntervalSeconds:5,waves:kind==='horde'?[[{template:template.id,rank:'normal',count:10}],[{template:template.id,rank:'normal',count:10}],[{template:template.id,rank:'normal',count:10},{template:template.id,rank:'elite',count:1}]]:[[{template:template.id,rank:'normal',count:2}]],...(kind==='defend'?{objectiveHp:10000}:{}),loot:'field-event'});
table.rares.push({_row:4,id:'visible-rare',region,zone:table.zones[0].id,name:'实机稀有',spots:[{x:174,y:256},{x:180,y:256},{x:186,y:256}],template:template.id,cooldownMinutes:20,affixes:[2,3],resource:art('rare'),loot:'field-rare'});
const produced=generateProductionIsland(table,table.islands[0],catalogues);registerProducedWorld(produced as unknown as ProducedWorld);for(const [key,rows]of Object.entries(table))if(key!=='source')(worldTables[key as keyof typeof worldTables] as unknown[]).push(...rows as unknown[]);
const db=await startDatabase({temporary:true}),pool=new Pool({connectionString:db.dsn,max:4});await migrate(pool);const apiPort=await freePort(),webPort=await freePort(),app=createApp(pool,{testLogin:true,fieldQa:false,origins:['http://127.0.0.1:'+webPort]});await app.listen({host:'127.0.0.1',port:apiPort});
const base=(configFactory as any)({mode:'development'}),publicWorld={...worldTables,gates:worldTables.gates.map(({region,...row})=>row)};
const vite=await createViteServer({...base,configFile:false,mode:'development',plugins:[{name:'declared-w2-visible-fixture',enforce:'pre',transform(_source,id){if(id.replaceAll('\\','/').endsWith('/config/json/world.json'))return {code:JSON.stringify(publicWorld),map:null};if(id.replaceAll('\\','/').endsWith('/packages/content/open-world/production.json'))return {code:JSON.stringify({islands:[produced]}),map:null};}}],server:{...base.server,port:webPort,proxy:{'/api':{target:'http://127.0.0.1:'+apiPort,ws:true}}}});await vite.listen();
// Declared fixture grants through setup only; UI still logs in and runs actual combat/actions.
const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'w2_visible_20261007'}}),cookie=String(login.headers['set-cookie']).split(';')[0],created=(await app.inject({method:'POST',url:'/api/character',headers:{cookie},payload:{name:'W2可见验收'}})).json();created.level=50;created.gold=100000;created.material=100000;created.starsea.features.push('events','waypoint','field-dungeon','forge','bounty');created.lastRegion=region;created.world={waypoints:[],exploration:{},worldTier:1,unlockedWorldTier:1};created.starsea.location={map:region,...table.islands[0].landing};await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[created,created.id]);resolveBuild(created);
let closed=false;const control=createControlServer((req,res)=>{if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping');void close();}else{res.writeHead(404);res.end();}});await new Promise<void>(resolve=>control.listen(0,'127.0.0.1',resolve));
async function close(){if(closed)return;closed=true;await vite.close();await app.close();await pool.end();const cleanup=await db.stop();await writeFile(out+'/cleanup.json',JSON.stringify(cleanup,null,2)+'\n');control.close();console.log('W2 visible cleanup',JSON.stringify(cleanup));}
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void close());
const report={url:'http://127.0.0.1:'+webPort+'/',stop:'http://127.0.0.1:'+String((control.address() as {port:number}).port)+'/stop',username:'w2_visible_20261007',versions,scope:'Visible IAB; two-zone generated 512 production registry with fieldQa=false; declared level50/wallet and real 10HP zero-attack templates. Actual real-time server World and private rewards, no fake kills/time/settlements. Not natural acquisition or six-island acceptance.'};await writeFile(out+'/fixture.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
