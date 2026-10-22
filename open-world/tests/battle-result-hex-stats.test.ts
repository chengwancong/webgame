import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {hexCombatStatsHtml} from '../apps/web/src/battle-result-panel.ts';
import type {HexCombatStats} from '../packages/contracts/hex-combat-stats.ts';
const rule=(rune:string,triggers:number,share:number|null)=>({rule:rune+'-r',rune,source:'s',triggers,directDamage:10,share});
const stats=(over:Partial<HexCombatStats>={}):HexCombatStats=>({source:'server',coverage:'complete',metric:'direct-hp-damage',triggerMetric:'rule-trigger-events',totalDamage:100,directDamage:40,share:0.4,rules:[rule('hex-chain-lightning',5,0.125)],...over});
it('renders complete stats with trigger count and damage share',()=>{
 const html=hexCombatStatsHtml(stats());expect(html).toContain('词缀战绩');expect(html).toContain('连锁闪电');expect(html).toContain('触发 5 次');expect(html).toContain('直接伤害占比 12.5%');expect(html).not.toContain('仅统计部分战斗');expect(html).not.toContain('收益');
});
it('does not render unavailable, missing or empty stats',()=>{
 expect(hexCombatStatsHtml(stats({coverage:'unavailable'}))).toBe('');expect(hexCombatStatsHtml(undefined)).toBe('');expect(hexCombatStatsHtml(stats({rules:[]}))).toBe('');
});
it('shows only trigger count when share is null, and a partial note',()=>{
 const html=hexCombatStatsHtml(stats({coverage:'partial',rules:[rule('hex-chain-lightning',3,null)]}));expect(html).toContain('触发 3 次');expect(html).not.toContain('占比');expect(html).toContain('仅统计部分战斗');
});
it('sorts by triggers, caps at four rows and escapes unknown names',()=>{
 const html=hexCombatStatsHtml(stats({rules:[rule('<img onerror=x>',9,null),rule('a',1,null),rule('b',2,null),rule('c',3,null),rule('d',4,null)]}));
 expect(html).toContain('&lt;img onerror=x&gt;');expect(html).not.toContain('<img');expect((html.match(/<li>/g)??[]).length).toBe(4);expect(html.indexOf('触发 9')).toBeLessThan(html.indexOf('触发 4'));expect(html).not.toContain('触发 1 次');
});
it('lays the result panel out as a flex column so hex stats and footer are not clipped by fixed grid rows',()=>{
 const css=readFileSync(new URL('../apps/web/src/battle-result-panel.css',import.meta.url),'utf8');
 const rule=css.match(/\.result\{[^}]*\}/)![0];
 expect(rule).toContain('display:flex');expect(rule).toContain('flex-direction:column');expect(rule).not.toContain('grid-template-rows');
 expect(css).toMatch(/\.result>\.loot-body\{flex:1 1 0/);
});
