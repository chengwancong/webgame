import {it,expect} from 'vitest';
import {dungeonFrameNotices} from '../apps/web/src/dungeon-feedback.ts';
it('active combat retains real target, mana and unknown cast failure feedback',()=>{
 expect(dungeonFrameNotices('running','running',[{reason:'target'},{reason:'resource'},{reason:'future'}])).toEqual(['目标已失效。','能量不足。','本次技能未释放。']);
});
it('a persisted success takes priority over stale cast failures on completion and restore',()=>{
 const failures=[{reason:'target'}];expect(dungeonFrameNotices('running','success',failures)).toEqual(['挑战成功，战利品已保存。']);
 expect(dungeonFrameNotices(undefined,'success',failures)).toEqual(['挑战成功，战利品已保存。']);
 expect(dungeonFrameNotices('success','success',failures)).toEqual([]);
});
it('failure and abandonment report a neutral result once, without pretending every ending is death or replaying old failures',()=>{
 for(const status of ['failed','abandoned'] as const){expect(dungeonFrameNotices('running',status,[{reason:'cooldown'}])).toEqual(['本次挑战已结束，请查看结算。']);expect(dungeonFrameNotices(status,status,[{reason:'target'}])).toEqual([]);}
 expect(dungeonFrameNotices('success','closed',[{reason:'target'}])).toEqual([]);
});
