import type {TacticalCell,TacticalIntent,TacticalUnit} from '../../contracts/tactical.ts';
import {tacticalArchetypes,tacticalGraybox} from '../../content/tactical-content.ts';
import {aligned,area,compareCells,direction,distance,hasLineOfSight,inside,lineCells,ray,reachableFor,sameCell} from './geometry.ts';
import {checkOutcome,damage,emit,heroOf,living,movePower,moveUnit,summon,type Resolution,type TacticalEncounterState} from './runtime.ts';

const enemies=(s:TacticalEncounterState)=>living(s).filter(u=>u.side==='enemy');
const order=(a:TacticalUnit,b:TacticalUnit)=>Number(b.eliteAffixes.includes('swift'))-Number(a.eliteAffixes.includes('swift'))||a.id.localeCompare(b.id);
function base(s:TacticalEncounterState,u:TacticalUnit,sequence:number):TacticalIntent{
 const range=u.kind==='boss'?1:tacticalArchetypes[u.kind as keyof typeof tacticalArchetypes].range;
 return {id:`${s.battleId}:round:${s.round}:${u.id}`,sourceId:u.id,type:'move-only',sequence,cells:[],line:[],damage:0,range,move:movePower(u),executeRound:s.round};
}
function options(s:TacticalEncounterState,u:TacticalUnit){return [{cell:u.cell,cost:0,path:[u.cell]},...reachableFor(s,u,movePower(u),u.kind==='assassin')];}
function close(s:TacticalEncounterState,u:TacticalUnit,target=heroOf(s).cell){
 const paths=[{cell:u.cell,cost:0,path:[u.cell]},...reachableFor(s,u,s.board.width*s.board.height,u.kind==='assassin')];
 const best=paths.sort((a,b)=>distance(a.cell,target)-distance(b.cell,target)||a.cost-b.cost||compareCells(a.cell,b.cell))[0];
 const path=best.path.slice(0,movePower(u)+1);return {cell:path[path.length-1],cost:path.length-1,path};
}
function far(s:TacticalEncounterState,u:TacticalUnit,min=0,teleport=false){
 const hero=heroOf(s);const cells=teleport?area(s.board,{x:Math.floor(s.board.width/2),y:Math.floor(s.board.height/2)},Math.max(s.board.width,s.board.height)).filter(c=>!living(s).some(v=>sameCell(v.cell,c))):options(s,u).map(v=>v.cell);
 const preferred=cells.filter(c=>distance(c,hero.cell)>=min);
 return (preferred.length?preferred:cells).sort((a,b)=>distance(b,hero.cell)-distance(a,hero.cell)||distance(a,u.cell)-distance(b,u.cell)||compareCells(a,b))[0]??u.cell;
}
function chase(s:TacticalEncounterState,u:TacticalUnit,i:TacticalIntent):TacticalIntent{
 const target=heroOf(s),near=close(s,u);i.destination=near.cell;i.targetId=target.id;
 if(distance(near.cell,target.cell)<=1){i.type='chase';i.effect='attack';i.damage=u.kind==='boss'?tacticalGraybox.boss.damage:tacticalGraybox.enemies[u.kind as keyof typeof tacticalGraybox.enemies].damage;}
 return i;
}
/** Pure intent selection. Inputs contain only publicly visible battlefield facts. */
export function planEnemyIntent(s:TacticalEncounterState,u:TacticalUnit,sequence:number):TacticalIntent{
 const i=base(s,u,sequence),hero=heroOf(s),dist=distance(u.cell,hero.cell);
 if(u.statuses.some(t=>t.id==='stunned'))return {...i,effect:'stun',move:0,reason:'stunned'};
 if(u.eliteAffixes.includes('teleport')&&dist<=1)return {...i,effect:'teleport',destination:far(s,u,tacticalGraybox.affixes.teleport.minDistance,true)};
 if(u.kind==='boss'){
  if(u.prepared?.kind==='boss')return {...i,type:'grid',effect:'boss-blast',cells:u.prepared.cells,damage:tacticalGraybox.boss.bigDamage,tier:'lethal'};
  if(u.statuses.some(t=>t.id==='exhausted'))return {...i,move:0,reason:'exhausted'};
  if(s.round===1||(s.round-1)%4===0)return {...i,type:'grid',effect:'boss-mark',cells:area(s.board,hero.cell,1),tier:'lethal',executeRound:s.round+1};
  return chase(s,u,i);
 }
 if(u.kind==='melee'||u.kind==='swarm')return chase(s,u,i);
 if(u.kind==='ranged'){
  if(dist<=1)return {...i,destination:far(s,u,3),reason:'retreat-adjacent'};
  if(dist<=i.range&&hasLineOfSight(s.board,u.cell,hero.cell))return {...i,type:'lock',effect:'attack',targetId:hero.id,line:lineCells(u.cell,hero.cell),damage:tacticalGraybox.enemies.ranged.damage};
  const destination=options(s,u).filter(p=>distance(p.cell,hero.cell)>=3&&distance(p.cell,hero.cell)<=i.range&&hasLineOfSight(s.board,p.cell,hero.cell)).sort((a,b)=>a.cost-b.cost||compareCells(a.cell,b.cell))[0]?.cell??far(s,u,3);
  return {...i,destination};
 }
 if(u.kind==='charger'){
  if(u.prepared?.kind==='charge')return {...i,type:'grid',effect:'charge',cells:u.prepared.cells,line:u.prepared.cells,damage:tacticalGraybox.enemies.charger.damage};
  if(aligned(u.cell,hero.cell)&&dist<=6)return {...i,type:'charge-windup',effect:'charge',line:ray(s,u.cell,direction(u.cell,hero.cell),Math.max(s.board.width,s.board.height)),targetId:hero.id,executeRound:s.round+1,tier:'heavy'};
  const destination=options(s,u).filter(p=>aligned(p.cell,hero.cell)&&distance(p.cell,hero.cell)<=6).sort((a,b)=>a.cost-b.cost||compareCells(a.cell,b.cell))[0]?.cell??close(s,u).cell;
  return {...i,destination};
 }
 if(u.kind==='shaman'){
  const allies=enemies(s).filter(v=>v.id!==u.id);
  const injured=allies.filter(v=>v.hp<v.maxHp*0.5).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id.localeCompare(b.id))[0];
  if(injured)return {...i,type:'buff',effect:'heal',targetId:injured.id};
  const exposed=allies.filter(v=>distance(v.cell,hero.cell)<=1).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(exposed)return {...i,type:'buff',effect:'shield',targetId:exposed.id};
  return {...i,destination:far(s,u,4),reason:'support-reposition'};
 }
 if(u.kind==='guard'){
  const exposed=enemies(s).filter(v=>v.id!==u.id&&distance(v.cell,hero.cell)<=1).sort((a,b)=>a.id.localeCompare(b.id))[0];
  if(exposed){const destination=options(s,u).filter(p=>distance(p.cell,exposed.cell)<=1).sort((a,b)=>distance(a.cell,hero.cell)-distance(b.cell,hero.cell)||a.cost-b.cost||compareCells(a.cell,b.cell))[0]?.cell;
   if(destination)return {...i,effect:'protect',targetId:exposed.id,destination};}
  return chase(s,u,i);
 }
 if(u.kind==='artillery'){
  if(u.prepared?.kind==='artillery')return {...i,type:'grid',effect:'attack',cells:u.prepared.cells,damage:tacticalGraybox.enemies.artillery.damage};
  const heroReach=options(s,hero).map(p=>p.cell);
  const candidate=area(s.board,hero.cell,1).filter(c=>distance(u.cell,c)<=i.range&&hasLineOfSight(s.board,u.cell,c)).map(cell=>({cell,cells:area(s.board,cell,1)})).filter(v=>v.cells.some(c=>sameCell(c,hero.cell))).sort((a,b)=>b.cells.filter(c=>heroReach.some(h=>sameCell(h,c))).length-a.cells.filter(c=>heroReach.some(h=>sameCell(h,c))).length||compareCells(a.cell,b.cell))[0];
  return candidate?{...i,type:'grid',effect:'artillery-mark',cells:candidate.cells,executeRound:s.round+1}:{...i,destination:far(s,u),reason:'no-markable-grid'};
 }
 if(u.kind==='assassin'){
  if(s.round===1)return {...i,hidden:true,destination:far(s,u,2),reason:'hidden-approach'};
  const back={x:hero.cell.x-hero.facing.x,y:hero.cell.y-hero.facing.y};
  const reachable=options(s,u);const behind=reachable.find(p=>sameCell(p.cell,back));
  const near=behind??(hero.hp<hero.maxHp*0.5?reachable.filter(p=>distance(p.cell,hero.cell)<=1).sort((a,b)=>a.cost-b.cost||compareCells(a.cell,b.cell))[0]:undefined);
  if(near)return {...i,type:'chase',effect:'attack',targetId:hero.id,destination:near.cell,damage:tacticalGraybox.enemies.assassin.damage*(behind?tacticalGraybox.enemies.assassin.rearMultiplier!:1)};
  return {...i,destination:close(s,u,back).cell,reason:'flank'};
 }
 if(u.kind==='summoner'){
  const count=enemies(s).filter(v=>v.summonedBy===u.id).length;
  if((u.cooldowns.summon??0)<=s.round&&count<tacticalGraybox.enemies.summoner.summonLimit!)return {...i,type:'summon',effect:'summon'};
  if(dist<=1)return {...i,effect:'teleport',destination:far(s,u,4,true)};
  return {...i,type:'lock',effect:'curse',targetId:hero.id,line:lineCells(u.cell,hero.cell)};
 }
 return i;
}
export function revealEnemyIntents(s:TacticalEncounterState,r?:Resolution,ambush=false){
 s.intents=enemies(s).filter(u=>u.activeFromRound<=s.round).sort(order).map((u,index)=>{
  const planned=planEnemyIntent(s,u,index);
  return ambush?{...base(s,u,index),destination:close(s,u).cell,reason:'player-ambush'}:planned;
 });
 if(s.difficulty==='normal'){
  let total=s.intents.reduce((sum,i)=>sum+i.damage,0);const hp=heroOf(s).hp+heroOf(s).shield;
  for(let at=s.intents.length-1;at>=0&&total>=hp;at--){const intent=s.intents[at];if(intent.damage<=0)continue;
   total-=intent.damage;s.intents[at]={...intent,type:'move-only',effect:undefined,damage:0,cells:[],line:[],reason:'lethal-guard',destination:close(s,s.units.find(u=>u.id===intent.sourceId)!).cell};
   if(r)emit(r,'intent-downgraded','lethal-guard',{sourceId:intent.sourceId,intentId:intent.id});
  }
 }
 for(const guard of enemies(s).filter(u=>u.kind==='guard'))guard.facing=direction(guard.cell,heroOf(s).cell);
}
function fizzle(r:Resolution,intent:TacticalIntent,reason:string){intent.fizzled=true;emit(r,'intent-fizzled',reason,{intentId:intent.id});}
function moveTo(r:Resolution,u:TacticalUnit,to:TacticalCell|undefined){
 if(!to||sameCell(u.cell,to))return;
 const path=reachableFor(r.state,u,movePower(u),u.kind==='assassin').find(p=>sameCell(p.cell,to))?.path;
 if(path)moveUnit(r,u,path,'enemy-move');
}
/** Executes only the already revealed intent; it never selects a replacement attack. */
export function executeEnemyIntent(r:Resolution,intent:TacticalIntent){
 const s=r.state,u=s.units.find(v=>v.id===intent.sourceId),hero=heroOf(s);
 r.sourceId=intent.sourceId;r.ownerTurnId=`${s.battleId}:${intent.sourceId}:${s.round}`;if(!u||u.hp<=0){fizzle(r,intent,'source-dead');return;}
 if(u.statuses.some(t=>t.id==='stunned')&&intent.effect!=='stun'){fizzle(r,intent,'stunned');return;}
 if(intent.type==='move-only'){
  if(intent.effect==='teleport'&&intent.destination){if(!living(s).some(v=>sameCell(v.cell,intent.destination!))){u.cell={...intent.destination};emit(r,'teleport','teleport',{targetId:u.id,cell:u.cell});}else fizzle(r,intent,'occupied-teleport');}
  else if(intent.effect!=='stun')moveTo(r,u,intent.destination);
  if(intent.effect==='stun')u.statuses=u.statuses.filter(t=>t.id!=='stunned');
 }else if(intent.type==='chase'){
  const candidates=options(s,u).filter(p=>distance(p.cell,hero.cell)<=1);
  const preferred=u.kind==='assassin'?{x:hero.cell.x-hero.facing.x,y:hero.cell.y-hero.facing.y}:undefined;
  candidates.sort((a,b)=>Number(preferred&&!sameCell(a.cell,preferred))-Number(preferred&&!sameCell(b.cell,preferred))||a.cost-b.cost||compareCells(a.cell,b.cell));
  const destination=candidates[0]??close(s,u);moveTo(r,u,destination.cell);
  if(distance(u.cell,hero.cell)<=1)damage(r,hero,intent.damage,'chase',u);else fizzle(r,intent,'target-out-of-reach');
 }else if(intent.type==='lock'){
  const target=s.units.find(v=>v.id===intent.targetId);
  if(!target||target.hp<=0||distance(u.cell,target.cell)>intent.range||!hasLineOfSight(s.board,u.cell,target.cell)){fizzle(r,intent,'line-of-sight-or-range');return;}
  const first=lineCells(u.cell,target.cell).slice(1).map(c=>living(s).find(v=>sameCell(v.cell,c))).find(v=>!!v);
  if(!first){fizzle(r,intent,'no-line-target');return;}
  if(intent.effect==='curse'){first.statuses=first.statuses.filter(t=>t.id!=='curse');first.statuses.push({id:'curse',sourceId:u.id,remaining:1,amount:tacticalGraybox.enemies.summoner.curseMultiplier!});emit(r,'status','curse',{targetId:first.id});}
  else damage(r,first,intent.damage,'lock',u);
 }else if(intent.type==='buff'){
  const target=s.units.find(v=>v.id===intent.targetId&&v.hp>0);
  if(!target){fizzle(r,intent,'buff-target-dead');return;}
  if(intent.effect==='heal'){const amount=Math.min(target.maxHp-target.hp,tacticalGraybox.enemies.shaman.heal!);target.hp+=amount;emit(r,'heal','shaman',{targetId:target.id,amount});}
  else{target.shield=Math.max(target.shield,tacticalGraybox.enemies.shaman.shield!);emit(r,'shield','shaman',{targetId:target.id,amount:target.shield});}
 }else if(intent.type==='summon'){
  const before=s.units.length;summon(r,u,tacticalGraybox.enemies.summoner.summonCount!);u.cooldowns.summon=s.round+tacticalGraybox.enemies.summoner.summonCooldown!;
  if(s.units.length===before)fizzle(r,intent,'no-summon-space');
 }else if(intent.type==='charge-windup'){
  u.prepared={kind:'charge',cells:intent.line,origin:{...u.cell},direction:direction(u.cell,intent.line[0]??hero.cell),executeRound:s.round+1};emit(r,'windup','charge',{cells:intent.line});
 }else if(intent.type==='grid'){
  if(intent.effect==='artillery-mark'||intent.effect==='boss-mark'){
   u.prepared={kind:intent.effect==='boss-mark'?'boss':'artillery',cells:intent.cells,executeRound:s.round+1};emit(r,'windup',intent.effect,{cells:intent.cells});
  }else if(intent.effect==='charge'){
   const first=intent.cells[0],prepared=u.prepared;const dir=prepared?.direction;delete u.prepared;
   if(!dir||!prepared?.origin||!sameCell(u.cell,prepared.origin)||(first&&!sameCell({x:u.cell.x+dir.x,y:u.cell.y+dir.y},first))){fizzle(r,intent,'charge-displaced');return;}
   const path=[{...u.cell}];let hit=false;
   for(const c of intent.cells){const target=living(s).find(v=>v.id!==u.id&&sameCell(v.cell,c));if(target){damage(r,target,intent.damage,'charge',u);hit=true;break;}path.push(c);}
   moveUnit(r,u,path,'charge');if(!hit){u.statuses.push({id:'stunned',sourceId:u.id,remaining:1,amount:0});emit(r,'status','charge-wall-stun',{targetId:u.id});}
  }else{
   delete u.prepared;const targets=living(s).filter(v=>v.id!==u.id&&intent.cells.some(c=>sameCell(c,v.cell)));
   for(const target of targets)damage(r,target,intent.damage,intent.effect==='boss-blast'?'boss-blast':'artillery',u);
   if(!targets.length)fizzle(r,intent,'empty-grid');
   if(intent.effect==='boss-blast'){u.statuses.push({id:'exhausted',sourceId:u.id,remaining:1,amount:tacticalGraybox.boss.exhaustedMultiplier,expiresOnRound:s.round+2});emit(r,'status','boss-exhausted',{targetId:u.id});}
  }
 }
 if(u.kind==='boss'&&u.hp>0&&u.phase===2&&intent.effect!=='boss-blast'&&intent.effect!=='boss-mark')summon(r,u,1);
 checkOutcome(s);
}
export function executeEnemyIntents(r:Resolution){
 const actionId=r.actionId,sourceId=r.sourceId;
 for(const intent of r.state.intents){if(r.state.outcome)break;r.actionId=`${intent.id}:action`;executeEnemyIntent(r,intent);}
 r.actionId=actionId;r.sourceId=sourceId;r.ownerTurnId=undefined;checkOutcome(r.state);
}
