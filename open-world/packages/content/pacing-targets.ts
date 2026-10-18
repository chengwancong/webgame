import raw from '../../config/json/pacing-targets.json';
import {pacingTargetTablesSchema,pacingScenes} from '../contracts/pacing.ts';
export const pacingTargets=pacingTargetTablesSchema.parse(raw);
export const pacingSettings=new Map(pacingTargets.settings.map(r=>[r.id,r.value]));
export const pacingWeights=Object.fromEntries(pacingScenes.map(id=>[id,pacingTargets.builds.find(r=>r.id==='weights')![id]])) as Record<typeof pacingScenes[number],number>;
export const pacingBuildTargets=pacingTargets.builds.filter(r=>r.id!=='weights');
