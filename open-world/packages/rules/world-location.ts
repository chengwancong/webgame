import type {CharacterState} from '../contracts/index.ts';
import {regions,fieldRegionInfo} from '../content/index.ts';
import {starseaHub,starseaIslands,starseaBossMaps,isStarseaRegion} from '../content/starsea/index.ts';
import {starseaRegionOpen} from './starsea.ts';
export function regionUnlocked(s:CharacterState,region:string){const field=fieldRegionInfo(region);if(field)return Boolean(s.starsea&&starseaRegionOpen(s.starsea,field.island??region));return regions.some(r=>r.id===region)&&(isStarseaRegion(region)?Boolean(s.starsea&&starseaRegionOpen(s.starsea,region)):region==='town'||s.progress.regions.includes(region.replace(/-boss$/,'')));}
export function rememberRegion(s:CharacterState,region:string){if(!regionUnlocked(s,region))throw Error('尚未解锁这张地图。');const boss=starseaBossMaps.indexOf(region);s.lastRegion=boss>=0?starseaIslands[boss]:region.replace(/-boss$/,'');}
export function resumeRegion(s:CharacterState){return s.lastRegion&&regionUnlocked(s,s.lastRegion)?s.lastRegion:regionUnlocked(s,s.progress.safe)?s.progress.safe:s.starsea?starseaHub:'town';}
