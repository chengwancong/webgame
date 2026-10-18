import type {Reward,Vec} from '../../../packages/contracts/index.ts';
import {distance,lineOfSight} from '../../../packages/simulation/navigation.ts';
import type {Region} from '../../../packages/content/index.ts';
import {settings} from '../../../packages/content/index.ts';
import {art,smallArt} from './ui-assets.ts';
const priority={legendary:3,rare:2,magic:1,common:0};
/** Claim candidates use actual world positions, never fanned-out icon positions. */
export function nearbyLoot(rewards:Reward[],region:Region,hero:Vec){return rewards.filter(r=>r.region===region.id&&distance(r.position,hero)<settings.pickupRadius&&lineOfSight(region,hero,r.position)).sort((a,b)=>priority[b.gear.quality]-priority[a.gear.quality]||distance(a.position,hero)-distance(b.position,hero)||a.id.localeCompare(b.id)).slice(0,24);}
export function groundLootArt(reward:Reward){return art('gear-'+reward.gear.base);}
export function groundLootTexture(reward:Reward){return smallArt('gear-'+reward.gear.base);}
export function lootLayout(rewards:Reward[]){const placed:{reward:Reward;x:number;y:number}[]=[];for(const reward of [...rewards].sort((a,b)=>a.id.localeCompare(b.id))){const bx=(reward.position.x-reward.position.y)*32,by=(reward.position.x+reward.position.y)*18;let x=bx,y=by;for(let n=0;n<=rewards.length*3;n++){x=bx+(n===0?0:((n-1)%3-1)*90);y=by-(n===0?0:(Math.floor((n-1)/3)+1)*100);if(!placed.some(p=>Math.abs(p.x-x)<86&&Math.abs(p.y-y)<94))break;}placed.push({reward,x,y});}return placed;}
