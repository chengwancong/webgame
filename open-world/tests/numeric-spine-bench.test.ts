import {it,expect} from 'vitest';
import {benchSample,type Axis,targets} from '../tools/spine/bench.ts';
import {standardState,resolvePlayer,referencePlayer} from '../tools/spine/player.ts';
import {continuousBurstWindow} from '../tools/spine/math.ts';
const standard=resolvePlayer('标准人50',standardState(50)),opening=referencePlayer('opening').player;
it('B3平滑窗口保留稳态速率，跨90帧边界的单跳按时间积分而非整笔消失',()=>{
 const constant=Object.fromEntries(Array.from({length:90},(_,i)=>[i+1,1]));expect(continuousBurstWindow(constant,90).value).toBeCloseTo(30,10);
 const before=continuousBurstWindow({4:100,90:100},90),after=continuousBurstWindow({5:100,91:100},90);expect(before.effectiveTicks).toBe(75);expect(before.weightedDamage).toBeCloseTo(100+100/60);expect(Math.abs(after.value/before.value-1)).toBeLessThan(.02);
});
it('真实测量台各轴在一次施法延迟1帧和窗口偏移1帧时误差小于2%',()=>{
 for(const player of [standard,opening])for(const axis of ['D1','dense','spread','B3','EHP','AV'] as Axis[]){
  const base=benchSample(player,axis,41,standard.build.stats.hp);
  for(const options of [{omitCast:0},{extraTicks:1}]){
   const next=benchSample(player,axis,41,standard.build.stats.hp,options);
   expect(base.value,player.id+'/'+axis).not.toBeNull();expect(next.value,player.id+'/'+axis).not.toBeNull();
   expect(Math.abs(next.value!/base.value!-1),player.id+'/'+axis+'/'+JSON.stringify(options)).toBeLessThan(.02);
  }
 }
},60000);
it('木桩耗尽必须拒绝；不输出被生命截断的假DPS',()=>{
 const spawns=targets(50,1);spawns[0].hp=1e9;
 expect(()=>benchSample(standard,'D1',41,standard.build.stats.hp,{spawns})).toThrow('目标耗尽');
});
it('保留原式EHP删失；有限窗口容量和固定原始输入均可复核',()=>{
 const sample=benchSample(standard,'EHP',41,standard.build.stats.hp);
 expect(sample.seconds).toBe(120);expect(sample.potentialRaw).toBeCloseTo(standard.build.stats.hp/20*120,5);
 expect(sample.censored).toBe(true);expect(sample.literalEHP).toBeNull();
 expect(sample.value).toBeGreaterThan(sample.receivedRaw);expect(sample.armorOnlyInput).toBeGreaterThan(0);
});
