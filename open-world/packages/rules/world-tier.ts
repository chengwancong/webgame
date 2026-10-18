import type {CharacterState} from '../contracts/index.ts';
import {worldTiersSchema,worldProgressSchema,type WorldTier} from '../contracts/open-world.ts';
import {starseaBossMaps,starseaIslands,starseaMap,hardmodeBossLevels,bossLevels,hardmodeBands} from '../content/starsea/index.ts';
import raw from '../content/world-tiers.json';

export const worldTiers=worldTiersSchema.parse(raw);
/** 4 → 深渊, 5 → 深渊 II … 玩家可见处不再出现“深渊 5”。 */
export function roman(n:number){if(!Number.isInteger(n)||n<1||n>100)return String(n);let result='';for(const [value,label] of [[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']] as const)while(n>=value){result+=label;n-=value;}return result;}
export function worldTier(tier:number):WorldTier{const t=worldTiers.tiers.find(x=>x.tier===tier);if(t)return t;const g=worldTiers.growth,base=worldTiers.tiers.at(-1);if(!g||!base||!Number.isInteger(tier)||tier<=g.afterTier||tier>g.maxTier)throw Error('Unknown world tier '+tier);const n=tier-g.afterTier;return {...base,tier,name:g.name+' '+roman(n+1),monster:{hp:base.monster.hp*g.hp**n,attack:base.monster.attack*g.attack**n},reward:Object.fromEntries(Object.entries(base.reward).map(([k,v])=>[k,v*g.reward**n])) as WorldTier['reward']};}
/** 危险 ★ 按怪物生命的档位；奖励 ★ 按四种收益的平均倍率。都由服务端算，客户端只画星。 */
export function tierStars(t:WorldTier){const hp=t.monster.hp,reward=(t.reward.xp+t.reward.gold+t.reward.material+t.reward.gear)/4;
 const stars=(v:number,steps:number[])=>steps.findIndex(s=>v<s)+1||steps.length+1;
 return {danger:stars(hp,[1.3,2,4,9]),rewardStars:stars(reward,[1.15,1.45,1.85,2.4])};
}
/** 推荐等级取自该档解锁条件里已有的等级门槛，不新增规则。 */
export function tierLevel(t:WorldTier):number|null{
 const u=t.unlock;
 if(u.kind==='hardmode_bosses')return u.level;
 if(u.kind==='hardmode')return hardmodeBands[0]?.[0]??null;
 if(u.kind==='boss'){const i=starseaBossMaps.indexOf(u.value);return bossLevels[i]??null;}
 return null;
}
/** Unlock is derived from current progress each time; nothing extra is stored. */
export function worldTierUnlocked(s:{level?:number;world?:CharacterState['world'];starsea?:{bosses:readonly string[];hardmode:boolean}|null},tier:number){
 let t;try{t=worldTier(tier);}catch{return false;}const u=t.unlock;
 const base=u.kind==='default'||u.kind==='boss'&&Boolean(s.starsea?.bosses.includes(u.value))||u.kind==='hardmode'&&Boolean(s.starsea?.hardmode)||u.kind==='hardmode_bosses'&&(s.level??0)>=u.level&&u.bosses.every(id=>s.world?.hardmodeBosses?.includes(id));
 return base&&(!worldTiers.growth||tier<=worldTiers.growth.afterTier||(s.world?.unlockedWorldTier??1)>=tier);
}
/** Locked tiers say exactly what is missing; unlocked ones stay quiet. */
function unlockLine(t:WorldTier,s:Pick<CharacterState,'level'|'world'|'starsea'>){
 if(t.tier>worldTiers.tiers.length){const prev=worldTier(t.tier-1);return `在${prev.name}里打通一座地城后开启`;}
 if(t.unlock.kind==='default')return '';
 if(t.unlock.kind!=='hardmode_bosses')return t.unlock.text;
 const done=t.unlock.bosses.filter(id=>s.world?.hardmodeBosses?.includes(id)).length,total=t.unlock.bosses.length;
 const left=t.unlock.bosses.filter(id=>!s.world?.hardmodeBosses?.includes(id)).map(id=>starseaMap(starseaIslands[starseaBossMaps.indexOf(id)]).name).join('、');
 return `${t.unlock.text}；裂星潮首领 ${done}/${total}${left?'，还差：'+left:''}`;
}
export function worldTierChoices(s:Pick<CharacterState,'level'|'world'|'starsea'>){const count=worldTiers.growth?Math.min(worldTiers.growth.maxTier,Math.max(worldTiers.tiers.length+1,(s.world?.unlockedWorldTier??1)+1)):worldTiers.tiers.length;return Array.from({length:count},(_,n)=>{const t=worldTier(n+1),stars=tierStars(t);return {tier:t.tier,name:t.name,unlocked:worldTierUnlocked(s,t.tier),danger:stars.danger,rewardStars:stars.rewardStars,summary:t.summary,level:tierLevel(t),unlockText:unlockLine(t,s),unlockSummary:t.tier>worldTiers.tiers.length?'通关上一档地城':t.unlock.kind==='default'?'':t.unlock.text,monster:t.monster,reward:t.reward};});}
export function recordWorldTierClear(s:CharacterState,tier:number){if(tier<4||!worldTierUnlocked(s,tier)||!s.world)return;const cap=worldTiers.growth?.maxTier??worldTiers.tiers.length;s.world.unlockedWorldTier=Math.max(s.world.unlockedWorldTier,Math.min(cap,tier+1));}
/** Call only for server-verified dead bosses. A retained normal encounter cannot
 * count as a hardmode kill after the world changes phase. */
export function recordHardmodeBoss(s:CharacterState,region:string,monsterLevel:number){const i=starseaBossMaps.indexOf(region);if(i<0||!s.starsea?.hardmode||monsterLevel<hardmodeBossLevels[i])return false;const w=s.world??=worldProgressSchema.parse({});w.hardmodeBosses??=[];if(!w.hardmodeBosses.includes(region))w.hardmodeBosses.push(region);return true;}
/** Selected tier, clamped to what progress still allows (a tier never outlives its unlock). */
export function activeWorldTier(s:Pick<CharacterState,'starsea'|'world'> & {level?:number}){const chosen=s.world?.worldTier??1;return worldTierUnlocked(s,chosen)?chosen:1;}
export function tierDifficulty(tier:number){const t=worldTier(tier);return {hp:t.monster.hp,attack:t.monster.attack,armor:1};}
/** Kill rewards of a camp frozen at `tier`; whole numbers, rounded once per kill. */
export function tierReward(tier:number,gain:{xp:number;gold:number;material:number}){const r=worldTier(tier).reward;return {xp:Math.round(gain.xp*r.xp),gold:Math.round(gain.gold*r.gold),material:Math.round(gain.material*r.material)};}
