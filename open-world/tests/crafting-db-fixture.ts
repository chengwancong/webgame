import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {craftMaterials} from '../packages/content/crafting.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {regionById} from '../packages/content/index.ts';
import {starseaIslands} from '../packages/content/starsea/index.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import type {CharacterState} from '../packages/contracts/index.ts';
export function craftingDatabaseFixture(name:string){
 const dsn=process.env.AW_DATABASE_URL;if(!dsn||new URL(dsn).port==='8612')throw Error('必须使用隔离PostgreSQL');
 const schema='qa_'+name+'_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema}),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
 return {pool,app,start:async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();},stop:async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();},player:async()=>{
  const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:name+'_'+randomUUID().replaceAll('-','').slice(0,15)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
  const request=async(path:string,payload?:unknown)=>{const r=await app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:payload as any});return {status:r.statusCode,body:r.json()};};
  const created=await request('character',{name:'工坊验收'}),lease=(await request('control',{client_id:randomUUID()})).body.lease_id,s=created.body as CharacterState;
  delete s.story;delete s.starsea;s.level=60;s.gold=1000000;s.progress.regions.push(...starseaIslands);const p=ensureProgression(s);for(const m of craftMaterials)p.materials[m.id]=200;
  await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
  const saved=async():Promise<CharacterState>=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;
  const save=async(state:CharacterState)=>pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,s.id]);
  const forge=regionById('ss-map-port').landmarks.find(l=>l.kind==='forge')!;
  const command=async(action:unknown)=>({command_id:randomUUID(),revision:(await saved()).revision,lease_id:lease,region:'ss-map-port',position:{x:forge.x,y:forge.y},action});
  const passStage=async()=>{const d=dungeonContent.definitions.filter(d=>d.numericStage).sort((a,b)=>b.numericStage!-a.numericStage!)[0],id=randomUUID();await pool.query("INSERT INTO ow_dungeons(id,leader,status,ended,data) VALUES($1,$2,'success',now(),$3)",[id,s.id,{definition:d}]);await pool.query('INSERT INTO ow_dungeon_completions(character,dungeon,instance) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[s.id,d.id,id]);};
  return {s,lease,request,saved,save,command,passStage};
 }};
}
