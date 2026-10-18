import {it,expect} from 'vitest';
import {report,hits,length,allow} from '../tools/copy-voice-scan.ts';
// docs/ui-copy-voice.md §6：禁用词即失败；按钮 / HUD / Toast 超长给出告警列表。
const result=report();
it('scanner sees the main player-facing surfaces',()=>{
 expect(result.entries.length).toBeGreaterThan(500);
 for(const source of ['client','config','server'] as const)expect(result.entries.some(e=>e.source===source)).toBe(true);
 expect(hits('有输出秒数 15/16（93.8%）')).toContain('输出秒数');
 expect(hits('5 · 深渊 5')).toEqual([]);
 expect(length('正在出航…')).toBe(5);
});
it('allowlist only registers proper nouns with a reason',()=>{
 for(const t of allow.terms){expect(t.term.length).toBeGreaterThan(0);expect(t.reason.length).toBeGreaterThan(4);}
 for(const t of allow.lengthExceptions){expect(t.reason.length).toBeGreaterThan(4);}
});
it('player-visible copy contains no banned words',()=>{
 const lines=result.bannedHits.map(e=>`${e.file}:${e.line} [${e.words.join(',')}] ${e.text}`);
 expect(lines,lines.slice(0,80).join('\n')).toEqual([]);
});
it('lists over-length buttons, HUD lines and toasts',()=>{
 if(result.overLimit.length)console.warn('文案超长告警 '+result.overLimit.length+' 条\n'+result.overLimit.map(e=>`${e.file}:${e.line} ${e.kind} ${e.chars}/${e.limit} ${e.text}`).join('\n'));
 expect(result.overLimit).toEqual([]);
});
