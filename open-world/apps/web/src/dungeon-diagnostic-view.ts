import type {DungeonDiagnostic} from '../../../packages/contracts/dungeons.ts';
import {sectionTitleHtml,statRowHtml,esc} from './ui-components.ts';
import {meterHtml} from './ui-components.ts';
import {combatAdviceHtml,combatFatalHitHtml,combatKeyProgressHtml} from './combat-review-view.ts';
const keyProgress=(d:DungeonDiagnostic)=>d.key?{stage:d.key.stage,dungeon:null,materials:d.key.materials,required:d.key.required,obtained:d.key.obtained}:null;
/** All values and advice are server-resolved; this view only formats them. Measurement stays unseen. */
export function dungeonDiagnosticHtml(d:DungeonDiagnostic,place=''){
 const bossLeft=d.bossRemainingPercent===null?'':meterHtml({value:Number(d.bossRemainingPercent.toFixed(1)),max:100,label:'首领还剩多少',valueText:'end'});
 return `<section class="dungeon-diagnostic" aria-label="本次差距">${sectionTitleHtml(d.defeated===false?'这一趟没闯过':'你倒在了这里')}${d.defeated===false?'':combatFatalHitHtml(d.fatal)}${bossLeft}${d.suggestions.length?`<p class="ui-caption">${esc(d.suggestions.join('；'))}</p>`:''}${combatAdviceHtml(d.advice)}${combatKeyProgressHtml(keyProgress(d),place)}</section>`;
}
