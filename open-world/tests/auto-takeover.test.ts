import {it,expect} from 'vitest';
import {World,takeoverResumeTicks} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {skillSchema} from '../packages/contracts/index.ts';
// 27 号 R1：全自动下走位输入即临时接管，不切模式；松手 1.5 秒后以当前位置为锚点恢复自动。
function world(){
 const skill=skillSchema.parse({id:'takeover-test',name:'QA',description:'takeover',kind:'single',damage:10,range:3,radius:0,cooldown:30,cost:0,windup:0,duration:1});
 const w=new World({...regionById('meadow'),safe:{x:10,y:10},obstacles:[]},{hp:1000,attack:10,armor:0,speed:2,mana:100,regen:0,effects:[]},[skill],[{id:'target',name:'target',kind:'melee',x:22,y:10,hp:100000,attack:0,boss:false,elite:false,art:'raider'}],[],41);
 w.radius=40;w.setMode('auto');return w;
}
it('movement input takes over without leaving auto, pauses auto after release, then resumes after 1.5 s',()=>{
 const w=world(),start={...w.hero.position};
 for(let i=0;i<10;i++)w.step();expect(w.hero.position.x).toBeGreaterThan(start.x);expect(w.takingOver()).toBe(false);
 w.control(-1,0);const before=w.hero.position.x;for(let i=0;i<10;i++)w.step();
 expect(w.mode).toBe('auto');expect(w.takingOver()).toBe(true);expect(w.hero.position.x).toBeLessThan(before);
 w.control(0,0);const released={...w.hero.position};for(let i=0;i<takeoverResumeTicks-5;i++)w.step();
 expect(w.takingOver()).toBe(true);expect(w.hero.position).toEqual(released);
 for(let i=0;i<10;i++)w.step();expect(w.takingOver()).toBe(false);expect(w.anchor).toEqual(released);
 for(let i=0;i<20;i++)w.step();expect(w.hero.position.x).toBeGreaterThan(released.x);
});
it('click-to-move in auto is also a takeover, and an explicit mode change clears it',()=>{
 const w=world();w.go({x:5,y:10});for(let i=0;i<5;i++)w.step();expect(w.takingOver()).toBe(true);expect(w.mode).toBe('auto');
 w.setMode('semi');expect(w.takingOver()).toBe(false);w.setMode('auto');expect(w.takingOver()).toBe(false);
});
