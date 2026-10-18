import {it,expect,vi,afterEach} from 'vitest';
import {CombatAudio,soundPriority} from '../apps/web/src/combat-audio.ts';
class Source{
 stopped=false;type='sine';frequency={value:0,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()};onended:any;buffer:any;
 connect(){return this;}disconnect(){}start(){}stop(){this.stopped=true;}
}
class Context{
 currentTime=0;state='running';sampleRate=1000;destination={};sources:Source[]=[];
 createOscillator(){const n=new Source();this.sources.push(n);return n;}createBufferSource(){return this.createOscillator();}
 createBiquadFilter(){return new Source();}createGain(){return {gain:{setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()},connect(){return this;},disconnect(){}};}
 createStereoPanner(){return {pan:{value:0},connect(){return this;},disconnect(){}};}createDynamicsCompressor(){return {threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0},connect(){return this;},disconnect(){}};}
 createBuffer(_channels:number,length:number){return {getChannelData:()=>new Float32Array(length)};}
}
afterEach(()=>vi.unstubAllGlobals());
it('limits cues by simulation ticks, tolerates tick reset and budgets entire layered voices',()=>{
 let ctx:Context;vi.stubGlobal('AudioContext',class extends Context{constructor(){super();ctx=this;}});const a=new CombatAudio();
 expect(a.play('hit',10,.2)).toBe(true);expect(a.play('hit',12,.2)).toBe(false);expect(a.play('hit',13,.2)).toBe(true);expect(a.play('hit',0,.2)).toBe(true);
 a.reset();for(let i=0;i<12;i++)expect(a.play('cast',20+i,.2)).toBe(true);expect(a.play('cast',32,.2)).toBe(false);
 expect(a.play('shield-break',32,.2)).toBe(true);expect(a.play('danger',32,.2)).toBe(true);expect(soundPriority('danger')).toBeGreaterThan(soundPriority('shield-break'));expect(ctx!.sources.some(s=>s.stopped)).toBe(true);
});
it('synthesizes every cue without external audio assets',()=>{
 vi.stubGlobal('AudioContext',Context);const a=new CombatAudio();for(const [i,kind] of ['hit','crit','hurt','kill','shield-up','shield-hit','shield-break','miss'].entries())expect(a.play(kind,i*8,.2)).toBe(true);
});
