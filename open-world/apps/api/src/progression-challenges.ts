import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {randomUUID,randomInt} from 'node:crypto';
import {z} from 'zod';
import {command,versions,type CharacterState,type Snapshot,type Receipt} from '../../../packages/contracts/index.ts';
import {challengeRunInput,raidRoleSchema,type RaidLobby,type ChallengeResult} from '../../../packages/contracts/progression-challenges.ts';
import {challengeContent,seasonActive} from '../../../packages/content/progression-challenges.ts';
import {ensureChallengeProgress,challengeAvailability,consumeChallenge,simulateChallenge,awardSeasonXp} from '../../../packages/rules/progression-challenges.ts';
import {awardProgression} from '../../../packages/rules/deep-progression.ts';
import {applyXp} from '../../../packages/rules/index.ts';

type Identity={account:string;session:string;resume?:string};
type Context={dungeonsEnabled?:boolean;pool:Pool;identity:(req:unknown)=>Promise<Identity>;state:(c:Pool|PoolClient,who:Identity,lock?:boolean)=>Promise<CharacterState>;snapshot:(c:Pool|PoolClient,s:CharacterState)=>Promise<Snapshot>;write:(who:Identity,input:z.infer<typeof command>,body:unknown,fn:(c:PoolClient,s:CharacterState)=>Promise<{delta?:Receipt['delta']}> )=>Promise<Receipt>;fail:(code:string,message:string,status?:number)=>never};
const uuid=z.uuid(),raidCommand=command.extend({lobby_id:uuid}).strict();
const zero=()=>({gold:0,xp:0,material:0});

export function registerProgressionChallenges(app:FastifyInstance,ctx:Context){
 const {pool,identity,state,snapshot,write}=ctx;
 function fail(code:string,message:string,status?:number):never{return ctx.fail(code,message,status);}
 const definition=(id:string)=>{const d=challengeContent.entries.find(d=>d.id===id);if(!d)fail('CHALLENGE','挑战不存在。',404);return d;};
 const award=(s:CharacterState,result:ChallengeResult):Receipt['delta']=>{
  const p=ensureChallengeProgress(s);p.last=result;
  if(!result.won)return zero();
  s.gold+=result.reward.gold;s.material+=result.reward.material;applyXp(s,result.reward.xp);
  p.bestTier=Math.max(p.bestTier,result.tier);awardSeasonXp(s,challengeContent.season.challengeXp);
  const d=definition(result.challenge_id),growth=awardProgression(s,{region:d.region,boss:true,elite:true,source:d.kind});
  return {...result.reward,progression:growth};
 };
 const lobbyView=(row:{id:string;leader:string;raid:string;created:Date|string;data:any}):RaidLobby=>{
  const d=definition(row.raid),members=row.data.members as RaidLobby['members'],required=challengeContent.limits.raidRoles;
  const full=members.length===challengeContent.limits.raidSize,roles=Object.entries(required).every(([role,n])=>members.filter(m=>m.role===role).length===n),ready=members.every(m=>m.ready);
  return {id:row.id,raid_id:row.raid,name:d.name,leader:row.leader,status:row.data.status,created:new Date(row.created).toISOString(),members,size:challengeContent.limits.raidSize,required,canStart:row.data.status==='forming'&&full&&roles&&ready,message:!full?`队伍 ${members.length}/${challengeContent.limits.raidSize}`:!roles?'需要 2 坦克、4 治疗、14 输出':!ready?'等待所有成员确认就绪':'队伍已就绪',...(row.data.result?{result:row.data.result}:{})};
 };
 async function lobbies(){return (await pool.query("SELECT * FROM ow_raid_lobbies WHERE expires>now() ORDER BY created DESC LIMIT 30")).rows.map(lobbyView);}
 app.get('/api/challenges',async req=>{
  const s=await state(pool,await identity(req)),p=ensureChallengeProgress(s),season=challengeContent.season,active=seasonActive(),xp=p.seasonXp[season.id]??0;
  const leaders=await pool.query(`SELECT name,tier,ticks FROM (SELECT DISTINCT ON (ch.id) ch.state->>'name' name,(r.data->>'tier')::integer tier,(r.data->>'ticks')::integer ticks FROM ow_challenge_runs r JOIN ow_characters ch ON ch.id=r.character WHERE r.data->>'kind'='nightmare' AND r.data->>'won'='true' AND r.created>=$1 AND r.created<$2 ORDER BY ch.id,tier DESC,ticks ASC,r.created ASC) best ORDER BY tier DESC,ticks ASC,name ASC LIMIT 20`,[season.start,season.end]);
  return {revision:s.revision,ruleset_version:versions.rules,entries:challengeContent.entries.map(d=>({id:d.id,name:d.name,kind:d.kind,description:d.description,level:d.level,...challengeAvailability(s,d),maxTier:d.kind==='nightmare'?challengeContent.nightmare.maxTier:1,stages:d.stages,reward:`金币 ${d.reward.gold} · 经验 ${d.reward.xp} · 强化石 ${d.reward.material}`})),bestTier:p.bestTier,last:p.last,season:{id:season.id,name:season.name,start:season.start,end:season.end,active,xp,rewards:season.rewards.map(r=>({...r,claimed:p.seasonClaims.includes(season.id+':'+r.id),eligible:active&&xp>=r.xp&&!p.seasonClaims.includes(season.id+':'+r.id)}))},leaderboard:leaders.rows,lobbies:await lobbies()};
 });
 app.get('/api/raids',async req=>{await state(pool,await identity(req));return {lobbies:await lobbies()};});
 app.post('/api/challenges/run',async req=>{if(ctx.dungeonsEnabled)fail('DUNGEON_ENTRY','请从副本目录开始挑战。');
  const who=await identity(req),v=command.extend(challengeRunInput.shape).strict().parse(req.body),d=definition(v.challenge_id);
  if(d.kind==='raid')fail('RAID','团队副本需要先组建队伍。');
  if(d.kind==='nightmare'&&v.tier>challengeContent.nightmare.maxTier)fail('TIER','噩梦层数已达上限。');
  return write(who,v,{...v,action:'challenge-run'},async(c,s)=>{
   const a=challengeAvailability(s,d);if(!a.eligible)fail('CHALLENGE_LOCKED',a.reason);
   const p=ensureChallengeProgress(s);if(d.kind==='nightmare'&&v.tier>p.bestTier+1)fail('TIER','请先通关前一层噩梦地下城。');
   consumeChallenge(s,d);const result=simulateChallenge(s,d,v.tier,randomInt(1,2147483647),randomUUID(),versions.rules);
   const delta=award(s,result);await c.query('INSERT INTO ow_challenge_runs(id,character,command,data) VALUES($1,$2,$3,$4)',[result.run_id,s.id,v.command_id,result]);
   return {delta};
  });
 });
 app.post('/api/challenges/season-claim',async req=>{
  const who=await identity(req),v=command.extend({reward_id:z.string().min(1).max(100)}).strict().parse(req.body);
  return write(who,v,{...v,action:'season-claim'},async(_c,s)=>{
   const season=challengeContent.season,r=season.rewards.find(r=>r.id===v.reward_id),p=ensureChallengeProgress(s);
   if(!r)fail('SEASON','赛季奖励不存在。');if(!seasonActive())fail('SEASON','本赛季未开放。');
   const key=season.id+':'+r.id;if(p.seasonClaims.includes(key))fail('CLAIMED','赛季奖励已领取。');
   if((p.seasonXp[season.id]??0)<r.xp)fail('SEASON_XP','赛季进度不足。');
   p.seasonClaims.push(key);s.gold+=r.gold;s.material+=r.material;const growth=awardProgression(s,{region:'abyss-boss',boss:false,elite:false,source:'season'});return {delta:{gold:r.gold,material:r.material,xp:0,progression:growth}};
  });
 });
 const roleCapacity=(members:RaidLobby['members'],role:z.infer<typeof raidRoleSchema>)=>{if(members.filter(m=>m.role===role).length>=challengeContent.limits.raidRoles[role])fail('RAID_ROLE','该职责名额已满。');};
 async function coordinator(c:PoolClient){if(!(await c.query('SELECT pg_try_advisory_xact_lock(8611020) ok')).rows[0].ok)fail('RAID_BUSY','团队正在更新，请稍后重试。');}
 app.post('/api/raids/create',async req=>{
  const who=await identity(req),v=command.extend({raid_id:z.string(),role:raidRoleSchema}).strict().parse(req.body),d=definition(v.raid_id);
  if(d.kind!=='raid')fail('RAID','请选择团队副本。');
  return write(who,v,{...v,action:'raid-create'},async(c,s)=>{
   await coordinator(c);const a=challengeAvailability(s,d);if(!a.eligible)fail('RAID_LOCKED',a.reason);
   const existing=await c.query("SELECT count(*)::integer n FROM ow_raid_lobbies WHERE leader=$1 AND expires>now() AND data->>'status'='forming'",[s.id]);
   if(existing.rows[0].n>=challengeContent.limits.maxOpenLobbies)fail('RAID_LIMIT','未完成的队伍过多，请先完成已有队伍。');
   const id=randomUUID();await c.query("INSERT INTO ow_raid_lobbies(id,leader,raid,expires,data) VALUES($1,$2,$3,now()+$4::interval,$5)",[id,s.id,d.id,challengeContent.limits.lobbyHours+' hours',{status:'forming',members:[{id:s.id,name:s.name,role:v.role,ready:false,build:s.build}]}]);return {};
  });
 });
 async function getLobby(c:PoolClient,id:string){const row=(await c.query('SELECT * FROM ow_raid_lobbies WHERE id=$1 AND expires>now() FOR UPDATE',[id])).rows[0];if(!row||row.data.status!=='forming')fail('RAID','队伍不存在、已结束或已过期。');return row;}
 app.post('/api/raids/join',async req=>{
  const who=await identity(req),v=raidCommand.extend({role:raidRoleSchema}).strict().parse(req.body);
  return write(who,v,{...v,action:'raid-join'},async(c,s)=>{
   await coordinator(c);const row=await getLobby(c,v.lobby_id),d=definition(row.raid),a=challengeAvailability(s,d);if(!a.eligible)fail('RAID_LOCKED',a.reason);
   const members=row.data.members as RaidLobby['members'];if(members.some(m=>m.id===s.id))fail('RAID_MEMBER','你已经在该队伍中。');if(members.length>=challengeContent.limits.raidSize)fail('RAID_FULL','队伍已满。');roleCapacity(members,v.role);
   members.push({id:s.id,name:s.name,role:v.role,ready:false,build:s.build});await c.query('UPDATE ow_raid_lobbies SET data=$1 WHERE id=$2',[row.data,row.id]);return {};
  });
 });
 app.post('/api/raids/ready',async req=>{
  const who=await identity(req),v=raidCommand.parse(req.body);return write(who,v,{...v,action:'raid-ready'},async(c,s)=>{
   await coordinator(c);const row=await getLobby(c,v.lobby_id),member=(row.data.members as RaidLobby['members']).find(m=>m.id===s.id);if(!member)fail('RAID_MEMBER','你不在该队伍中。');
   const a=challengeAvailability(s,definition(row.raid));if(!a.eligible)fail('RAID_LOCKED',a.reason);member.ready=true;member.build=s.build;await c.query('UPDATE ow_raid_lobbies SET data=$1 WHERE id=$2',[row.data,row.id]);return {};
  });
 });
 app.post('/api/raids/leave',async req=>{
  const who=await identity(req),v=raidCommand.parse(req.body);return write(who,v,{...v,action:'raid-leave'},async(c,s)=>{
   await coordinator(c);const row=await getLobby(c,v.lobby_id),members=row.data.members as RaidLobby['members'];if(!members.some(m=>m.id===s.id))fail('RAID_MEMBER','你不在该队伍中。');
   row.data.members=members.filter(m=>m.id!==s.id);if(!row.data.members.length){await c.query('DELETE FROM ow_raid_lobbies WHERE id=$1',[row.id]);return {};}
   const leader=row.leader===s.id?row.data.members[0].id:row.leader;await c.query('UPDATE ow_raid_lobbies SET leader=$1,data=$2 WHERE id=$3',[leader,row.data,row.id]);return {};
  });
 });
 app.post('/api/raids/start',async req=>{if(ctx.dungeonsEnabled)fail('DUNGEON_ENTRY','请从副本目录进入实时或自动团队模式。');
  const who=await identity(req),v=raidCommand.parse(req.body);return write(who,v,{...v,action:'raid-start'},async(c,s)=>{
   await coordinator(c);const row=await getLobby(c,v.lobby_id);if(row.leader!==s.id)fail('RAID_LEADER','仅队长可以发起挑战。');if(!lobbyView(row).canStart)fail('RAID_READY','需要完整职责队伍，且全员确认就绪。');
   const members=row.data.members as RaidLobby['members'],d=definition(row.raid),rows=await c.query('SELECT id,state FROM ow_characters WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[members.map(m=>m.id)]);
   const party=members.map(m=>{const current:CharacterState=m.id===s.id?s:rows.rows.find(r=>r.id===m.id)?.state;if(!current)fail('RAID_MEMBER','队员角色不存在。');if(current.build!==m.build)fail('RAID_BUILD','队员的技能和装备有变化，请重新确认准备。');const a=challengeAvailability(current,d);if(!a.eligible)fail('RAID_LOCKED',`${current.name}：${a.reason}`);return {state:current,role:m.role};});
   const result=simulateChallenge(s,d,1,randomInt(1,2147483647),randomUUID(),versions.rules,party);let leaderDelta:Receipt['delta']=zero();
   for(const member of party){const current=member.state;consumeChallenge(current,d);const delta=award(current,result);await c.query('INSERT INTO ow_challenge_runs(id,character,command,data) VALUES($1,$2,$3,$4)',[randomUUID(),current.id,v.command_id,result]);
    if(current.id===s.id){leaderDelta=delta;continue;}
    current.revision++;await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[current,current.id]);await c.query('UPDATE ow_permits SET build=$1 WHERE character=$2',[current.build,current.id]);
    const receipt:Receipt={command_id:v.command_id,revision:current.revision,delta,rewards:[],snapshot:await snapshot(c,current)};await c.query('INSERT INTO ow_receipts VALUES($1,$2,$3,$4)',[current.id,v.command_id,'raid:'+result.run_id,receipt]);await c.query('INSERT INTO ow_ledger(character,command,delta) VALUES($1,$2,$3)',[current.id,v.command_id,delta]);
   }
   row.data.status='complete';row.data.result=result;await c.query('UPDATE ow_raid_lobbies SET data=$1 WHERE id=$2',[row.data,row.id]);return {delta:leaderDelta};
  });
 });
}
