import {reviewPath} from './review-path.ts';
import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById,settings} from '../packages/content/index.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {acceptsPickup,defaultPickupFilter} from '../packages/rules/pickup-filter.ts';
import {gearWeaponType} from '../packages/rules/weapon-skills.ts';
import {versions,type Snapshot,type Permit} from '../packages/contracts/index.ts';

it('measures earned camp loot through real World/PG and preserves filtered rewards and pickup replay',async()=>{
 const owner=new Pool({connectionString:process.env.AW_DATABASE_URL}),schema='qa_loot_'+randomUUID().replaceAll('-','');await owner.query('CREATE SCHEMA '+schema);
 const pool=new Pool({connectionString:process.env.AW_DATABASE_URL,options:'-c search_path='+schema}),app=createApp(pool,{testLogin:true});await migrate(pool);await app.ready();
 const realNow=Date.now.bind(Date);let clock=realNow();const began=clock;vi.useFakeTimers({toFake:['Date']});const events:any[]=[];let evidence:any;
 try{
  const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'loot_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
  const request=async(path:string,body?:object)=>{clock=Math.max(clock,realNow());vi.setSystemTime(clock);const r=await app.inject({method:body?'POST':'GET',url:'/api/'+path,headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
  let s=(await request('character',{name:'真实掉落频率驾驶器'})).body as Snapshot,lease='';const initial=s.gear.length,region=worldTables.islands[0].region;let position=regionById(region).safe;
  const refresh=async()=>{const c=(await request('control',{client_id:s.id})).body;lease=c.lease_id;await pool.query('UPDATE ow_controls SET expires=$1 WHERE character=$2',[c.expires_at,s.id]);s=(await request('character')).body;};
  const command=async(path:string,body:object)=>{await refresh();const payload={command_id:randomUUID(),revision:s.revision,lease_id:lease,...body},r=await request(path,payload);expect(r.status,JSON.stringify(r.body)).toBe(200);if(r.body.snapshot)s=r.body.snapshot;expect((await request(path,payload)).body).toEqual(r.body);return r;};
  const filter={...defaultPickupFilter(),minimumQuality:'rare' as const};const seen=new Set<string>(),visits=new Map<string,number>();
  for(let round=0;round<600&&clock-began<3*3600000&&s.gear.length<settings.capacity;round++){
   await refresh();const camps=worldTables.camps.filter(c=>c.region===region&&s.worldView!.camps.includes(c.id)&&worldTables.zones.find(z=>z.id===c.zone)!.levelBand[0]<=s.level+1);
   const camp=camps.sort((a,b)=>(visits.get(a.id)??0)-(visits.get(b.id)??0)||Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y))[0];if(!camp)break;
   clock+=Math.hypot(camp.x-position.x,camp.y-position.y)/s.stats.speed*1000;await refresh();await pool.query("UPDATE ow_camp_cycles SET cleared_at=now()-interval '91 seconds' WHERE character=$1 AND cleared_at IS NOT NULL",[s.id]);
   const issued=await request('permit',{lease_id:lease,region,position:{x:camp.x,y:camp.y}});expect(issued.status,JSON.stringify(issued.body)).toBe(200);let permit=issued.body as Permit;
   const near=await request('field/camps',{lease_id:lease,permit_id:permit.id,position:{x:camp.x,y:camp.y}});expect(near.status,JSON.stringify(near.body)).toBe(200);const cycle=near.body.camps.find((c:any)=>c.id===camp.id);visits.set(camp.id,(visits.get(camp.id)??0)+1);if(!cycle?.spawns.length)continue;
   const build=resolveBuild(s),w=new World(regionById(region),build.stats,build.resolvedSkills,cycle.spawns,[],41);w.hero.position={x:camp.x-5,y:camp.y};w.setMode('auto');w.radius=40;
   for(let tick=0;tick<180*30&&w.hero.hp>0&&w.enemies.some(e=>e.alive);tick++)w.step();clock+=w.tick/30*1000;await refresh();permit=(await request('permit',{lease_id:lease,region,position:w.hero.position})).body;
   await command('combat/report',{permit_id:permit.id,build:permit.build,sequence:permit.sequence+1,from_tick:permit.from_tick,to_tick:permit.from_tick+w.tick,kills:w.kills.map(k=>({...k,tick:k.tick+permit.from_tick})),position:w.hero.position});
   const rewards=s.rewards.filter(r=>!seen.has(r.id));rewards.forEach(r=>seen.add(r.id));const weapon=s.gear.find(g=>g.id===s.equipment.weapon),accepted=rewards.filter(r=>acceptsPickup(r.gear,filter,weapon?gearWeaponType(weapon):null));
   events.push({camp:camp.id,minutes:(clock-began)/60000,level:s.level,seconds:w.tick/30,kills:w.kills.length,elites:w.kills.filter(k=>cycle.spawns.find((e:any)=>e.id===k.source_id)?.monster?.rank==='elite').length,dead:w.hero.hp<=0,issued:rewards.length,accepted:accepted.length,qualities:rewards.map(r=>r.gear.quality)});
   for(let at=0;at<accepted.length;at+=20)if(s.gear.length<settings.capacity)await command('reward/claim-many',{reward_ids:accepted.slice(at,at+20).map(r=>r.id)});
   const slots=new Set(s.gear.map(g=>g.slot));for(const slot of slots){const candidates=s.gear.filter(g=>g.slot===slot&&(g.requiredLevel??1)<=s.level),best=candidates.sort((a,b)=>(b.attack+b.armor)-(a.attack+a.armor))[0];if(best&&s.equipment[slot]!==best.id)await command('gear/equip',{gear_id:best.id});}
   clock+=35000;position=w.hero.position;if(w.hero.hp<=0)break;
  }
  await refresh();const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state;expect(stored.gear).toEqual(s.gear);
  const rows=(await pool.query('SELECT source FROM ow_kills WHERE character=$1',[s.id])).rows;expect(new Set(rows.map(r=>r.source)).size).toBe(rows.length);
  const unclaimed=(await pool.query('SELECT id FROM ow_rewards WHERE character=$1 AND claimed=false',[s.id])).rows;expect(new Set(unclaimed.map(r=>r.id))).toEqual(new Set(s.rewards.map(r=>r.id)));
  const minutes=(clock-began)/60000,bursts=events.filter(e=>e.elites>0&&e.issued>0);evidence={versions,seed:41,realWorld:true,realPostgres:true,initialBag:initial,capacity:settings.capacity,filter,minutes,full:s.gear.length>=settings.capacity,finalBag:s.gear.length,pending:s.rewards.length,gearIssued:events.reduce((n,e)=>n+e.issued,0),eliteBursts:bursts.length,burstIntervalsMinutes:bursts.map((b,i)=>b.minutes-(i?bursts[i-1].minutes:0)),events,limits:['Single newborn character, real earned gear, no grants or reward injection; deterministic World seed, private loot random remains production random.','Single-camp route excludes nearby fights; travel/recovery and confirmed camp waits use estimated/virtual time. This is a route observation, not a human population mean.','Rare minimum pickup filter; no automatic salvage or bag reset. Filtered ground rewards remain pending. Stops on full bag, death or observation budget.']};
 }finally{vi.useRealTimers();await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();if(evidence){await mkdir(reviewPath('docs/reviews/open-world-m2-m4/W11'),{recursive:true});await writeFile(reviewPath('docs/reviews/open-world-m2-m4/W11/loot-cadence-detail.json'),JSON.stringify(evidence,null,2));}}
},180000);
