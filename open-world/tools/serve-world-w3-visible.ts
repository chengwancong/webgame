/** Real isolated API + generated public island and48-cell dungeon maps.
 * Starts no browser and never touches the current development database. */
import {createServer as createViteServer} from 'vite';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {startDatabase,freePort} from './runtime.mjs';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {generateProductionIsland} from './build-production-islands.ts';
import {generateFieldDungeonStage} from './generate-field-dungeon.ts';
import {registerProducedWorld,registerProducedDungeon,type ProducedWorld} from '../packages/content/open-world/index.ts';
import {twoZoneIsland,catalogues} from '../tests/fixtures/production-island.ts';
import configFactory from '../apps/web/vite.config.ts';
import rawDungeons from '../packages/content/dungeons.json';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
import {stageKeyPools} from '../apps/api/src/stage-key-pools.ts';
import {worldProgressSchema} from '../packages/contracts/open-world.ts';
import {starseaBossMaps} from '../packages/content/starsea/index.ts';
import {versions} from '../packages/contracts/index.ts';
const out='docs/reviews/open-world-m2-m4/W3/visible';await mkdir(out,{recursive:true});
const table=twoZoneIsland(),region=table.islands[0].region,assets=catalogues.flatMap(c=>c.assets),find=(category:string,test=(a:any)=>true)=>{const asset=assets.find(a=>a.category===category&&test(a));if(!asset)throw Error('Missing accepted fixture art '+category);return asset.id;};
const ordinary=monsterContent.templates.find(t=>t.id==='ow-mon-wind-2')!,boss=monsterContent.templates.find(t=>t.id==='ow-boss-wind-1')!;
const controlled={...structuredClone(ordinary),id:'visible-w3-controlled',base:{hp:10,attack:0,armor:0},skills:[],ai:{...ordinary.ai,aggroRadius:1}},controlledBoss={...structuredClone(boss),id:'visible-w3-boss',base:{hp:10,attack:0,armor:0},ai:{...boss.ai,aggroRadius:1}},diagnosticBoss={...structuredClone(boss),id:'visible-w3-diagnostic-boss',base:{hp:1000000,attack:0,armor:0},ai:{...boss.ai,aggroRadius:1}};monsterContent.templates.push(controlled,controlledBoss,diagnosticBoss);
for(const p of stageKeyPools.slice(0,2)){p.dropProbability=0;p.required=2;}
table.dungeonEntrances.push({_row:4,id:'visible-w3-key-entry',region,zone:table.zones[0].id,x:124,y:256,dungeon:'visible-w3-key',resource:find('entrance'),stage:1},{_row:5,id:'visible-w3-diagnostic-entry',region,zone:table.zones[0].id,x:140,y:256,dungeon:'visible-w3-diagnostic',resource:find('entrance'),stage:2});
const island=generateProductionIsland(table,table.islands[0],catalogues);registerProducedWorld(island as unknown as ProducedWorld);for(const [key,rows]of Object.entries(table))if(key!=='source')(worldTables[key as keyof typeof worldTables] as unknown[]).push(...rows as unknown[]);
const chest={id:'visible-room-cache',name:'地城宝箱',x:7,y:24,resource:find('chest',a=>!a.id.includes('open')),openResource:find('chest',a=>a.id.includes('open'))};
const base={name:'钥匙受控地城',island:'ss-map-wind',artIsland:'mist',chapter:1,seed:41,level:4,safe:{x:5,y:24},portal:{x:42,y:24},rockCount:4,backdrop:'ss-scene-sky'};
const first=generateFieldDungeonStage({...base,id:'ss-dg-visible-key-first',stage:1,boss:false,chests:[chest],pack:[{template:controlled.id,rank:'elite',count:3,center:{x:20,y:24},radius:2}]},catalogues),last=generateFieldDungeonStage({...base,id:'ss-dg-visible-key-final',stage:2,boss:true,pack:[{template:controlledBoss.id,rank:'boss',count:1,center:{x:20,y:24},radius:2}]},catalogues),diagnostic=generateFieldDungeonStage({...base,name:'首领诊断受控地城',id:'ss-dg-visible-diagnostic',stage:1,boss:true,pack:[{template:diagnosticBoss.id,rank:'boss',count:1,center:{x:16,y:24},radius:1}]},catalogues),dungeons=[first,last,diagnostic];for(const d of dungeons)registerProducedDungeon(d);
const defs=structuredClone(rawDungeons) as any;defs.definitions.push({id:'visible-w3-key',name:'钥匙受控地城',kind:'normal',profiles:['realtime'],area:'ss-map-wind',stages:[first.region.id,last.region.id],numericStage:1,bossBudgetSeconds:70,policy:{feature:'field-dungeon',monsterLevel:4,timeLimitSeconds:240,normalGoals:{killCount:3,eliteCount:3},returnRegion:'ss-map-port',enemyScale:{hp:1,attack:1,hpPerStage:0,attackPerStage:0}}},{id:'visible-w3-diagnostic',name:'首领诊断受控地城',kind:'normal',profiles:['realtime'],area:'ss-map-wind',stages:[diagnostic.region.id],numericStage:2,bossBudgetSeconds:70,policy:{feature:'field-dungeon',monsterLevel:4,timeLimitSeconds:16,returnRegion:'ss-map-port',enemyScale:{hp:1,attack:1,hpPerStage:0,attackPerStage:0}}});
const db=await startDatabase({temporary:true}),pool=new Pool({connectionString:db.dsn,max:4});await migrate(pool);const apiPort=await freePort(),webPort=await freePort(),app=createApp(pool,{testLogin:true,fieldQa:false,dungeons:resolveDungeonContent(defs),origins:['http://127.0.0.1:'+webPort]});await app.listen({host:'127.0.0.1',port:apiPort});
const baseConfig=(configFactory as any)({mode:'development'}),publicWorld={...worldTables,gates:worldTables.gates.map(({region,...r})=>r)};
const vite=await createViteServer({...baseConfig,configFile:false,mode:'development',plugins:[{name:'w3-declared-visible',enforce:'pre',transform(_source,id){const p=id.replaceAll('\\','/');if(p.endsWith('/config/json/world.json'))return {code:JSON.stringify(publicWorld),map:null};if(p.endsWith('/packages/content/open-world/production.json'))return {code:JSON.stringify({islands:[island],dungeons}),map:null};}}],server:{...baseConfig.server,port:webPort,proxy:{'/api':{target:'http://127.0.0.1:'+apiPort,ws:true}}}});await vite.listen();
const username='w3_visible_20261007',login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(login.headers['set-cookie']).split(';')[0],character=(await app.inject({method:'POST',url:'/api/character',headers:{cookie},payload:{name:'W3可见验收'}})).json();character.level=50;character.gold=100000;character.material=100000;character.lastRegion=region;character.starsea.hardmode=true;character.starsea.location={map:region,...table.islands[0].landing};character.world=worldProgressSchema.parse({worldTier:4,hardmodeBosses:starseaBossMaps});await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[character,character.id]);
let closed=false;const control=createServer((req,res)=>{if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping');void close();}else{res.writeHead(404);res.end();}});await new Promise<void>(r=>control.listen(0,'127.0.0.1',r));async function close(){if(closed)return;closed=true;await vite.close();await app.close();await pool.end();const cleanup=await db.stop();await writeFile(out+'/cleanup.json',JSON.stringify(cleanup,null,2));control.close();console.log(JSON.stringify({cleanup}));}for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>void close());
const report={url:'http://127.0.0.1:'+webPort+'/',stop:'http://127.0.0.1:'+String((control.address() as {port:number}).port)+'/stop',username,character:character.id,versions,scope:'Visible IAB; generated512 public island and48 fixed dungeon stages, fieldQa=false; declared level50/wallet/endgame admission, controlled10HP zero-attack encounters and high-HP timeout boss; real server World, rewards, inputs, checkpoint and failure. No natural balance or six-island claim.'};await writeFile(out+'/fixture.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
