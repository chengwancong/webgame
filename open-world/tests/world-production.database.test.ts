import {reviewPath} from './review-path.ts';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables,loadWorldTables,validateWorldGeometry} from '../packages/content/world-tables.ts';
import {registerProducedWorld,type ProducedWorld} from '../packages/content/open-world/index.ts';
import {fieldRegionInfo,regionById} from '../packages/content/index.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {generateProductionIsland} from '../tools/build-production-islands.ts';
import {catalogues} from './fixtures/production-island.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Production island pipeline requires real temporary PostgreSQL');
const schema='qa_production_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
let app=createApp(pool,{testLogin:true,dungeons:false});
const sizes=Object.fromEntries(Object.entries(worldTables).filter(([k])=>k!=='source').map(([k,rows])=>[k,(rows as any[]).length]));
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();for(const [k,n] of Object.entries(sizes))(worldTables[k as keyof typeof worldTables] as any[]).splice(n);});
function workbook(path:string){const command="import runpy,json,sys; m=runpy.run_path('tools/config-export.py'); print(json.dumps(m['export_book'](sys.argv[1])[1],ensure_ascii=False))";return loadWorldTables(JSON.parse(execFileSync(process.env.AW_PYTHON??'python3',['-X','utf8','-c',command,path],{encoding:'utf8',windowsHide:true})));}
it('runs real workbook → exporter → geometry → references → production registry → normal server camp API, with pack and rectangle edits',async()=>{
 const evidence=[];
 for(const [index,path]of ['tests/fixtures/production-two-zone.xlsx','tests/fixtures/production-two-zone-variant.xlsx'].entries()){
  const table=workbook(path),suffix=index?'-edited':'';
  if(suffix)for(const [key,rows]of Object.entries(table)){if(key==='source')continue;for(const row of rows as any[]){row.id+=suffix;row.region+=suffix;if(row.zone)row.zone+=suffix;}}
  const generated=generateProductionIsland(table,table.islands[0],catalogues);
  validateWorldGeometry(table,[generated.region],{templates:new Set(monsterContent.templates.map(t=>t.id)),resources:new Set<string>(catalogues.flatMap(c=>c.assets.map((a:any)=>a.id))),dungeons:new Set(),events:new Set(),loot:new Set()});
  registerProducedWorld(generated as unknown as ProducedWorld);for(const [key,rows]of Object.entries(table))if(key!=='source')(worldTables[key as keyof typeof worldTables] as any[]).push(...rows as any[]);
  expect(fieldRegionInfo(generated.region.id)?.qa).toBe(false);expect(regionById(generated.region.id).width).toBe(512);
  const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'production_'+randomUUID().replaceAll('-','').slice(0,10)}});expect(login.statusCode,login.body).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
  const request=async(path:string,payload?:unknown)=>{const r=await app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:payload as any});expect(r.statusCode,r.body).toBe(200);return r.json();};
  const character=await request('character',{name:'正式内容测试'}),lease=(await request('control',{client_id:randomUUID()})).lease_id,permit=await request('permit',{lease_id:lease,region:generated.region.id,attempt_id:randomUUID()});
  const body={lease_id:lease,permit_id:permit.id,position:{x:table.camps[0].x,y:table.camps[0].y}},one=await request('field/camps',body),camp=one.camps.find((c:any)=>c.id===table.camps[0].id);
  expect(camp.spawns).toHaveLength(index?6:4);expect(camp.cycle).toBe(1);expect(camp.spawns.every((s:any)=>s.monster?.template===table.camps[0].pack[0].template)).toBe(true);
  const persisted=(await pool.query("SELECT data->'spawns' spawns FROM ow_camp_cycles WHERE character=$1 AND camp=$2",[character.id,camp.id])).rows[0].spawns;
  expect(persisted).toHaveLength(index?6:4);await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();expect(await request('field/camps',body)).toEqual(one);
  evidence.push({workbook:path,registeredAsProduction:!fieldRegionInfo(generated.region.id)!.qa,report:generated.report,rectangles:generated.map.groundZones.map(z=>z.rect),roads:generated.map.roads,actualApiMembers:camp.spawns.length,reconnectSameFrozenCycle:true});
 }
 expect(evidence[0].rectangles).not.toEqual(evidence[1].rectangles);expect(evidence[0].roads).not.toEqual(evidence[1].roads);
 await mkdir(reviewPath('docs/reviews/open-world-m2-m4/W1'),{recursive:true});await writeFile(reviewPath('docs/reviews/open-world-m2-m4/W1/config-chain.json'),JSON.stringify({passed:true,realPostgres:true,fieldQa:false,evidence},null,2)+'\n');
},30000);
