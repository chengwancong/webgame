import type {BossAccess,Progress} from '../contracts/index.ts';
import {regions} from '../content/index.ts';
import balance from '../content/encounter-balance.json';

// Server-owned eligibility; the UI consumes this resolved result, not total kills.
export function resolveBossAccess(progress:Progress):Record<string,BossAccess>{
 return Object.fromEntries(regions.filter(r=>r.boss&&!r.id.startsWith('ss-map-')).map(boss=>{
  const areaId=boss.id.replace(/-boss$/,''),area=regions.find(r=>r.id===areaId)!;
  const kills=progress.regionKills?.[areaId]??0,elites=progress.regionElites?.[areaId]??0;
  const cleared=progress.bosses.includes(boss.id),areaOpen=progress.regions.includes(areaId);
  const {requiredKills,requiredElites}=balance.bossEntry;
  const eligible=areaOpen&&(cleared||kills>=requiredKills&&elites>=requiredElites);
  const message=!areaOpen?'请先击败前一区域首领。':cleared?'已通关，可再次挑战。':eligible?'本地区清剿已完成，可挑战首领。':`先清剿${area.name}敌人 ${Math.min(kills,requiredKills)}/${requiredKills}，精英 ${Math.min(elites,requiredElites)}/${requiredElites}。`;
  return [boss.id,{areaId,kills,elites,requiredKills,requiredElites,eligible,cleared,message}];
 }));
}
