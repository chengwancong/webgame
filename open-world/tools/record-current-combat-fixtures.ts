import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {World} from '../packages/simulation/index.ts';
import {versions} from '../packages/contracts/index.ts';
import {stats,trace} from '../tests/fixtures/combat-feedback-scenario.ts';
import {vfxScenarios,runVfxScenario} from '../tests/fixtures/vfx-scenarios.ts';
// One-time current-rule baseline; never overwrite either historical fixture.
const feedback=new URL('../tests/fixtures/combat-feedback-current.json',import.meta.url),vfx=new URL('../tests/fixtures/vfx-gameplay-current.json',import.meta.url);
if(existsSync(feedback)||existsSync(vfx))throw Error('Current fixtures already recorded; do not rebase a failing test automatically');
const files=['packages/simulation/index.ts','packages/simulation/navigation.ts','packages/simulation/navigation-grid.ts','packages/simulation/collision.ts','packages/content/skills-expanded.ts','packages/content/combat-numerics.json','tests/fixtures/combat-feedback-scenario.ts','tests/fixtures/vfx-scenarios.ts'];
const meta={recorded:'2026-10-06',versions,reason:'Historical files predate the approved skill damage/range, armor and 8-direction navigation changes. Keep those files immutable and freeze current inputs separately.',source:files.map(file=>({file,sha256:createHash('sha256').update(readFileSync(new URL('../'+file,import.meta.url))).digest('hex')}))};
writeFileSync(feedback,JSON.stringify({meta,seed:41,stats,skills:['cut','bolt','ward'],trace:trace()},null,2));
const unchanged=new Set(['cut','whirl','rush','cleave','ground_slam','leap_strike','rampage','bolt','ember','chain','lance','snipe','barrage','lightning_bolt','frost','nova','ward','mend','barrier']);
writeFileSync(vfx,JSON.stringify({meta,seed:73,scenarios:Object.fromEntries(vfxScenarios.filter(s=>s.type!=='player'||unchanged.has(s.id)).map(s=>[s.type+'/'+s.id,runVfxScenario(World,s)]))},null,2));
console.log(JSON.stringify({feedback:feedback.pathname,vfx:vfx.pathname,versions}));
