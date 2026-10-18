import {test,expect} from 'vitest';
import {SoundMixer,mixerLimits,soundPriorities} from '../apps/web/src/audio/mixer.ts';
test('fifty same-frame native audio requests stay in budget and warning preempts',async()=>{
 let started=0,stopped=0;const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}),node=()=>({connect(){return this;},disconnect(){},gain:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),playbackRate:param(),frequency:param(),start(){started++;},stop(){stopped++;}});
 const context:any={currentTime:0,state:'running',destination:{},createGain:node,createStereoPanner:node,createDynamicsCompressor:node,createOscillator:node},mixer=new SoundMixer(()=>context),recipe={id:'hit',cooldown:0,layers:[{kind:'tone' as const,type:'sine' as const,from:400,duration:.1,weight:.5}]};
 for(let i=0;i<50;i++)mixer.play({...recipe,id:'hit/'+i},1,.7,soundPriorities.hit);
 expect(mixer.play({...recipe,id:'boss/warning'},1,.7,soundPriorities.warning)).toBe(true);await Promise.resolve();expect(started).toBeLessThanOrEqual(mixerLimits.perFrame);expect(stopped).toBeGreaterThan(0);expect(mixer.gate.voices.length).toBeLessThanOrEqual(mixerLimits.voices);expect(mixer.gate.voices.some(v=>v.priority===soundPriorities.warning)).toBe(true);
});
test('loaded sample variants play instead of synth, rotate without immediate repeats and keep synth fallback',async()=>{
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}}),played:unknown[]=[];let oscillators=0;
 const node=()=>({connect(){return this;},disconnect(){},gain:param(),pan:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),frequency:param(),playbackRate:param(),start(){},stop(){}});
 const buffers:Record<string,{duration:number}>={a:{duration:.2},b:{duration:.3}};
 const context:any={currentTime:0,state:'running',destination:{},createGain:node,createStereoPanner:node,createDynamicsCompressor:node,createOscillator:()=>{oscillators++;return node();},
  createBufferSource:()=>{const s:any=node();Object.defineProperty(s,'buffer',{set(b){played.push(b);}});return s;},decodeAudioData:async(bytes:ArrayBuffer)=>buffers[new TextDecoder().decode(bytes)]};
 const fetchStub=async(url:string)=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(url.endsWith('missing')?'x':url.slice(-1)).buffer});
 const original=globalThis.fetch;(globalThis as any).fetch=fetchStub;
 try{
  const mixer=new SoundMixer(()=>context),recipe={id:'cue/hit',cooldown:0,samples:['/s/a','/s/b'],layers:[{kind:'tone' as const,type:'sine' as const,from:400,duration:.1,weight:.5}]};
  expect(mixer.play(recipe,1,.7,soundPriorities.hit)).toBe(true);expect(oscillators).toBe(1);
  for(let i=0;i<5;i++)await Promise.resolve();await new Promise(r=>setTimeout(r,0));
  for(let t=2;t<12;t++)expect(mixer.play(recipe,t,.7,soundPriorities.hit)).toBe(true);
  expect(oscillators).toBe(1);expect(played).toHaveLength(10);for(let i=1;i<played.length;i++)expect(played[i]).not.toBe(played[i-1]);
  expect(mixer.play({...recipe,id:'other',samples:['/s/missing']},20,.7,soundPriorities.hit)).toBe(true);expect(oscillators).toBe(2);
 }finally{(globalThis as any).fetch=original;}
});
