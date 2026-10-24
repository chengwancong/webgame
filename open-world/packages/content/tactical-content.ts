import {z} from 'zod';
import archetypesRaw from './tactical-archetypes.json';
import grayboxRaw from './tactical-graybox.json';
import boardsRaw from './tactical-boards.json';

/** Sandbox-only authored content. No production coefficients, saves or loot tables. */
export const tacticalEnemyKinds=['melee','ranged','charger','shaman','guard','artillery','assassin','summoner','swarm'] as const;
export const tacticalEliteAffixIds=['swift','shielded','frost_nova','fire_trail','summon_minions','teleport'] as const;
export const tacticalSkillIds=['cut','whirl','ward','vortex_blade','throwing_knife','fan_of_knives','venom_needle','toxic_bomb'] as const;
export type TacticalEnemyKind=typeof tacticalEnemyKinds[number];
export type TacticalEliteAffixId=typeof tacticalEliteAffixIds[number];
export type TacticalSkillId=typeof tacticalSkillIds[number];
export type TacticalHeroId='sword'|'hidden';
const integer=z.number().int().nonnegative();
const positive=z.number().positive();
const fraction=z.number().min(0).max(1);
const identifier=z.string().min(1).max(80).regex(/^[a-z][a-z0-9_-]*$/);
const cellSchema=z.object({x:integer,y:integer}).strict();
const kindSchema=z.enum(tacticalEnemyKinds);
const affixSchema=z.enum(tacticalEliteAffixIds);
const skillIdSchema=z.enum(tacticalSkillIds);
const hpTierSchema=z.enum(['swarm','light','medium','heavy']);

export const tacticalArchetypeSchema=z.object({
 name:z.string().min(1),move:integer.max(12),range:integer.max(16),
 intentType:z.enum(['grid','chase','lock','buff','summon','charge-windup','move-only']),
 threat:positive,hpTier:hpTierSchema,
}).strict();
export const tacticalArchetypeCatalogSchema=z.object({version:z.literal(1),archetypes:z.record(kindSchema,tacticalArchetypeSchema)}).strict();
export const tacticalSkillConfigSchema=z.object({
 damage:integer,cooldown:integer.max(20),range:integer.max(16),
 shield:integer.optional(),dotDamage:integer.optional(),dotTicks:integer.optional(),
 zoneDamage:integer.optional(),duration:integer.optional(),
}).strict();
const enemyConfigSchema=z.object({
 damage:integer,heal:integer.optional(),shield:integer.optional(),frontalReduction:fraction.optional(),
 rearMultiplier:positive.optional(),curseMultiplier:positive.optional(),
 summonLimit:integer.optional(),summonCount:integer.optional(),summonCooldown:integer.optional(),
}).strict();
export const tacticalOrchestrationDefaultsSchema=z.object({
 priority:z.array(skillIdSchema).max(8),target:z.enum(['nearest','lowest-hp','support-first']),
 position:z.enum(['stay-close','keep-distance','behind-cover']),guard:z.enum(['on','off']),
}).strict();
export const tacticalGrayboxSchema=z.object({
 version:z.literal(1),
 hero:z.object({hp:positive,move:integer.max(12),critChance:fraction,critMultiplier:positive}).strict(),
 heroes:z.array(z.object({id:z.enum(['sword','hidden']),name:z.string().min(1),basicSkillId:skillIdSchema,skillIds:z.array(skillIdSchema).length(4)}).strict()).length(2),
 hpTiers:z.object({swarm:positive,light:positive,medium:positive,heavy:positive}).strict(),
 eliteHpMultiplier:positive,
 skills:z.record(skillIdSchema,tacticalSkillConfigSchema),
 enemies:z.record(kindSchema,enemyConfigSchema),
 affixes:z.object({
  swift:z.object({moveBonus:integer}).strict(),
  shielded:z.object({shield:integer}).strict(),
  frost_nova:z.object({damage:integer,duration:integer}).strict(),
  fire_trail:z.object({damage:integer,duration:integer}).strict(),
  summon_minions:z.object({threshold:fraction,count:integer}).strict(),
  teleport:z.object({minDistance:integer}).strict(),
 }).strict(),
 boss:z.object({name:z.string().min(1),hp:positive,damage:integer,bigDamage:integer,phaseThreshold:fraction,exhaustedMultiplier:positive,summonLimit:integer}).strict(),
 autopilot:z.object({
  killWeight:positive,damageTakenWeight:positive,damageDealtWeight:positive,priorityBonus:z.number().nonnegative(),
  positionWeight:z.number().nonnegative(),targetWeight:z.number().nonnegative(),guardBonus:z.number().nonnegative(),guardThreshold:fraction,
  defaults:tacticalOrchestrationDefaultsSchema,
 }).strict(),
}).strict();
export const tacticalBoardDefinitionSchema=z.object({
 id:identifier,name:z.string().min(1),region:z.literal('wind'),difficulty:z.enum(['normal','elite','boss']),
 width:z.number().int().min(8).max(10),height:z.number().int().min(8).max(10),blocked:z.array(cellSchema),heroSpawn:cellSchema,
 enemies:z.array(z.object({id:identifier,kind:kindSchema,cell:cellSchema,eliteAffixes:z.array(affixSchema).max(1),boss:z.literal(true).optional()}).strict()).min(1).max(8),
 burstGroup:z.array(identifier).min(2).max(3).optional(),burstOrigin:cellSchema.optional(),burstSkill:z.enum(['whirl','fan_of_knives']).optional(),
 countException:z.literal('swarm-majority-budget').optional(),
}).strict();
export const tacticalBoardCatalogSchema=z.object({version:z.literal(1),boards:z.array(tacticalBoardDefinitionSchema).length(5)}).strict();
export type TacticalArchetype=z.infer<typeof tacticalArchetypeSchema>;
export type TacticalSkillConfig=z.infer<typeof tacticalSkillConfigSchema>;
export type TacticalGraybox=z.infer<typeof tacticalGrayboxSchema>;
export type TacticalBoardDefinition=z.infer<typeof tacticalBoardDefinitionSchema>;
export type TacticalContent={archetypes:Record<TacticalEnemyKind,TacticalArchetype>;graybox:TacticalGraybox;boards:TacticalBoardDefinition[]};

const cellKey=(p:{x:number;y:number})=>`${p.x},${p.y}`;
const unique=(values:readonly string[],label:string)=>{if(new Set(values).size!==values.length)throw Error('Duplicate tactical '+label);};

export function tacticalBoardThreat(board:TacticalBoardDefinition,archetypes:Record<TacticalEnemyKind,TacticalArchetype>):number{
 return board.enemies.reduce((sum,enemy)=>sum+archetypes[enemy.kind].threat*(enemy.eliteAffixes.length?2:1),0);
}

/** Cardinal connectivity is a conservative content proof, not tactical movement execution. */
function validateStaticClearance(board:TacticalBoardDefinition){
 const inside=(p:{x:number;y:number})=>p.x>=0&&p.y>=0&&p.x<board.width&&p.y<board.height;
 const blocked=new Set(board.blocked.map(cellKey));
 const spawns=[board.heroSpawn,...board.enemies.map(enemy=>enemy.cell)];
 unique(board.blocked.map(cellKey),board.id+' blocker');
 unique(spawns.map(cellKey),board.id+' spawn');
 for(const p of [...board.blocked,...spawns,...(board.burstOrigin?[board.burstOrigin]:[])])if(!inside(p))throw Error('Tactical cell outside board '+board.id);
 for(const p of spawns)if(blocked.has(cellKey(p)))throw Error('Blocked tactical spawn '+board.id);
 if(board.burstOrigin&&(blocked.has(cellKey(board.burstOrigin))||spawns.some(p=>cellKey(p)===cellKey(board.burstOrigin!))))throw Error('Blocked tactical burst origin '+board.id);
 const seen=new Set([cellKey(board.heroSpawn)]),queue=[board.heroSpawn];
 for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[0,1],[1,0],[0,-1],[-1,0]]){
  const p={x:queue[i].x+dx,y:queue[i].y+dy},key=cellKey(p);
  if(inside(p)&&!blocked.has(key)&&!seen.has(key)){seen.add(key);queue.push(p);}
 }
 for(const p of [...spawns,...(board.burstOrigin?[board.burstOrigin]:[])])if(!seen.has(cellKey(p)))throw Error('Unreachable tactical spawn '+board.id);
}

export function validateTacticalContent(content:TacticalContent):TacticalContent{
 unique(content.boards.map(board=>board.id),'board ID');
 unique(content.graybox.heroes.map(hero=>hero.id),'hero ID');
 const heroes=new Set(content.graybox.heroes.map(hero=>hero.id));
 if(!heroes.has('sword')||!heroes.has('hidden'))throw Error('Missing tactical graybox hero');
 for(const hero of content.graybox.heroes){
  unique(hero.skillIds,hero.id+' skill');
  if(!hero.skillIds.includes(hero.basicSkillId)||content.graybox.skills[hero.basicSkillId].cooldown!==0)throw Error('Invalid tactical basic skill '+hero.id);
 }
 unique(content.graybox.autopilot.defaults.priority,'autopilot priority');
 for(const [id,skill]of Object.entries(content.graybox.skills)){
  if((skill.dotDamage===undefined)!==(skill.dotTicks===undefined))throw Error('Incomplete tactical DOT '+id);
  if((skill.zoneDamage===undefined)!==(skill.duration===undefined))throw Error('Incomplete tactical zone '+id);
 }
 if(content.boards.filter(board=>board.difficulty==='normal').length!==3||content.boards.filter(board=>board.difficulty==='elite').length!==1||content.boards.filter(board=>board.difficulty==='boss').length!==1)throw Error('Expected three normal, one elite and one boss tactical boards');
 for(const board of content.boards){
  validateStaticClearance(board);
  unique(board.enemies.map(enemy=>enemy.id),board.id+' enemy ID');
  for(const enemy of board.enemies){
   if(!content.archetypes[enemy.kind])throw Error('Unknown tactical archetype '+enemy.kind);
   unique(enemy.eliteAffixes,board.id+' affix');
  }
  const threat=tacticalBoardThreat(board,content.archetypes);
  if(board.difficulty!=='boss'&&board.enemies.some(enemy=>enemy.boss))throw Error('Boss outside tactical boss board '+board.id);
  if(board.difficulty==='normal'){
   if(threat<6||threat>9)throw Error('Normal tactical threat outside 6–9 '+board.id);
   if(new Set(board.enemies.map(enemy=>enemy.kind)).size>2)throw Error('Too many normal tactical archetypes '+board.id);
   if(board.enemies.some(enemy=>enemy.eliteAffixes.length))throw Error('Elite on normal tactical board '+board.id);
   const exception=board.countException==='swarm-majority-budget';
   if(exception&&(board.enemies.length!==6||board.enemies.filter(enemy=>enemy.kind==='swarm').length!==4))throw Error('Invalid tactical swarm count exception '+board.id);
   if(!exception&&(board.enemies.length<3||board.enemies.length>5))throw Error('Normal tactical enemy count outside 3–5 '+board.id);
   if(!board.burstGroup||!board.burstOrigin||!board.burstSkill)throw Error('Missing tactical burst group '+board.id);
   unique(board.burstGroup,board.id+' burst member');
   if(board.burstGroup.some(id=>!board.enemies.some(enemy=>enemy.id===id)))throw Error('Unknown tactical burst member '+board.id);
  }
  if(board.difficulty==='elite'){
   if(threat<10||threat>14)throw Error('Elite tactical threat outside 10–14 '+board.id);
   if(board.enemies.filter(enemy=>enemy.eliteAffixes.length===1).length!==1)throw Error('Expected one tactical elite affix carrier '+board.id);
  }
  if(board.difficulty==='boss'&&board.enemies.filter(enemy=>enemy.boss).length!==1)throw Error('Expected one tactical boss '+board.id);
 }
 return content;
}

/** Parse all three documents together so cross-file references fail before a battle starts. */
export function parseTacticalContent(input:{archetypes:unknown;graybox:unknown;boards:unknown}):TacticalContent{
 return validateTacticalContent({
  archetypes:tacticalArchetypeCatalogSchema.parse(input.archetypes).archetypes,
  graybox:tacticalGrayboxSchema.parse(input.graybox),
  boards:tacticalBoardCatalogSchema.parse(input.boards).boards,
 });
}
export const tacticalContent=parseTacticalContent({archetypes:archetypesRaw,graybox:grayboxRaw,boards:boardsRaw});
export const tacticalArchetypes=tacticalContent.archetypes;
export const tacticalGraybox=tacticalContent.graybox;
export const tacticalBoards=tacticalContent.boards;
export const tacticalBoardById=new Map(tacticalBoards.map(board=>[board.id,board]));
