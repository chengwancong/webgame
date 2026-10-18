import {wiredSamples} from './sample-bank.ts';
import {defaultAudioSettings,type AudioSettings} from './settings.ts';
import type {SoundRecipe} from './sound-recipes.ts';
type Voice={priority:number;finish:number;stop:()=>void;tick:number;frame?:number};
export const mixerLimits={voices:12,perFrame:12};
// 合成配方相对采样的电平：采样已按分级归一化，主音量直接等于设置音量。
export const synthGain=1.736;
export const soundPriorities={warning:6,boss:5,player:4,monster:3,hit:2,other:1};
export class VoiceGate{
 voices:Voice[]=[];private last=new Map<string,number>();private tick=-1;private frame=0;private frameClock=-1;
 admit(id:string,tick:number,now:number,priority:number,cooldown:number,finish:number,stop:()=>void,frameClock=tick){
  if(tick<this.tick)this.reset();if(frameClock!==this.frameClock){this.frameClock=frameClock;this.frame=0;}this.tick=tick;this.voices=this.voices.filter(v=>v.finish>now);
  if(tick-(this.last.get(id)??-Infinity)<cooldown)return false;
  const victim=[...this.voices].sort((a,b)=>a.priority-b.priority).find(v=>v.priority<priority);
  let replacement=false;if(this.voices.length>=mixerLimits.voices||this.frame>=mixerLimits.perFrame){if(!victim)return false;replacement=victim.frame===frameClock;victim.stop();this.voices=this.voices.filter(v=>v!==victim);}
  this.voices.push({priority,finish,stop,tick,frame:frameClock});if(!replacement)this.frame++;this.last.set(id,tick);return true;
 }
 reset(){for(const v of this.voices)v.stop();this.voices=[];this.last.clear();this.tick=-1;this.frame=0;this.frameClock=-1;}
}
export class SoundMixer{
 readonly gate=new VoiceGate();private context?:AudioContext;private master?:GainNode;private buses?:Record<'combat'|'ui'|'foley'|'ambience'|'music',GainNode>;private noiseCache=new Map<string,AudioBuffer>();private samples=new Map<string,AudioBuffer>();private requested=new Set<string>();private lastVariant=new Map<string,string>();private uiPlayed=new Map<string,number>();
 private settings={...defaultAudioSettings};private hidden=false;private musicFilter?:BiquadFilterNode;private duckUntil=0;private streams=new Map<string,{element:HTMLAudioElement;source:MediaElementAudioSourceNode;gain:GainNode}>();
 constructor(private create:()=>AudioContext=()=>new AudioContext()){}
 unlock(preload:string[]=[]){try{const a=this.audio();if(a.state==='suspended')void a.resume();for(const url of preload)this.load(url);}catch{}}
 private load(url:string){if(this.samples.has(url)||this.requested.has(url))return;this.requested.add(url);const a=this.audio();void fetch(url).then(res=>{if(!res.ok)throw Error('Sample unavailable');return res.arrayBuffer();}).then(bytes=>a.decodeAudioData(bytes)).then(buffer=>this.samples.set(url,buffer)).catch(()=>{});}
 // 多变体随机取一个已加载的，避免连续重复同一条。
 private pick(r:SoundRecipe){const files=r.samples??(r.sample?[r.sample]:[]);for(const url of files)this.load(url);const ready=files.filter(url=>this.samples.has(url));if(!ready.length)return undefined;const last=this.lastVariant.get(r.id);let i=Math.floor(Math.random()*ready.length);if(ready.length>1&&ready[i]===last)i=(i+1)%ready.length;this.lastVariant.set(r.id,ready[i]);return this.samples.get(ready[i]);}
 configure(settings:AudioSettings,hidden=false){this.settings={...settings};this.hidden=hidden;if(!this.context)return;const now=this.context.currentTime;this.master!.gain.setValueAtTime(hidden&&settings.muteBackground?0:settings.master,now);for(const [key,bus]of Object.entries(this.buses!)){const value=key==='combat'||key==='foley'?settings.effects:settings[key as 'music'|'ambience'|'ui'];bus.gain.setValueAtTime(value*(now<this.duckUntil&&['combat','music'].includes(key)?.501:1),now);}}
 duck(){const a=this.audio(),now=a.currentTime;this.duckUntil=now+.6;for(const key of ['combat','music'] as const){const gain=this.buses![key].gain,value=key==='combat'?this.settings.effects:this.settings.music;gain.cancelScheduledValues?.(now);gain.setValueAtTime(value*.501,now);if(gain.linearRampToValueAtTime){gain.setValueAtTime(value*.501,now+.6);gain.linearRampToValueAtTime(value,now+.7);}}}
 stream(slot:string,key:string,seconds=2){const url=wiredSamples(key,'loop')?.[0];if(url)this.streamUrl(slot,url,seconds);}
 streamUrl(slot:string,url:string,seconds=2,bus:'ambience'|'music'='ambience'){if(typeof Audio==='undefined')return;const a=this.audio(),old=this.streams.get(slot);if(old?.element.getAttribute('src')===url)return;const element=new Audio(url),source=a.createMediaElementSource(element),gain=a.createGain();element.loop=true;element.preload='metadata';source.connect(gain).connect(this.buses![bus]);gain.gain.setValueAtTime(0,a.currentTime);gain.gain.linearRampToValueAtTime(1,a.currentTime+seconds);this.streams.set(slot,{element,source,gain});void element.play().catch(()=>{source.disconnect();gain.disconnect();if(this.streams.get(slot)?.element===element)this.streams.delete(slot);});if(old){old.gain.gain.cancelScheduledValues(a.currentTime);old.gain.gain.setValueAtTime(old.gain.gain.value,a.currentTime);old.gain.gain.linearRampToValueAtTime(0,a.currentTime+seconds);setTimeout(()=>{old.element.pause();old.element.removeAttribute('src');old.source.disconnect();old.gain.disconnect();},seconds*1000);}}
 setLowHealth(low:boolean){if(!this.context)return;const a=this.context;if(!this.musicFilter&&low){this.musicFilter=a.createBiquadFilter();this.musicFilter.type='lowpass';this.buses!.music.disconnect();this.buses!.music.connect(this.musicFilter).connect(this.master!);}this.musicFilter?.frequency.setTargetAtTime(low?900:20000,a.currentTime,.1);}
 streamLevel(slot:string,level:number){const stream=this.streams.get(slot);if(stream&&this.context){stream.gain.gain.cancelScheduledValues(this.context.currentTime);stream.gain.gain.setValueAtTime(Math.max(0,Math.min(1,level)),this.context.currentTime);}}
 stopStream(slot:string){const s=this.streams.get(slot);if(s){s.element.pause();s.source.disconnect();s.gain.disconnect();this.streams.delete(slot);}}
 stopStreams(){for(const s of this.streams.values()){s.element.pause();s.source.disconnect();s.gain.disconnect();}this.streams.clear();}
 private audio(){if(this.context)return this.context;const a=this.context=this.create(),master=this.master=a.createGain(),compressor=a.createDynamicsCompressor();compressor.threshold.value=-8;compressor.knee.value=6;compressor.ratio.value=12;compressor.attack.value=.003;compressor.release.value=.15;master.connect(compressor).connect(a.destination);this.buses={combat:a.createGain(),ui:a.createGain(),foley:a.createGain(),ambience:a.createGain(),music:a.createGain()};for(const bus of Object.values(this.buses))bus.connect(master);this.configure(this.settings,this.hidden);return a;}
 private noise(duration:number,seed:number){const a=this.audio(),key=duration+':'+seed;let b=this.noiseCache.get(key);if(!b){b=a.createBuffer(1,Math.ceil(duration*a.sampleRate),a.sampleRate);const data=b.getChannelData(0);let s=seed||1;for(let n=0;n<data.length;n++){s=(Math.imul(s,1664525)+1013904223)>>>0;data[n]=s/2147483648-1;}this.noiseCache.set(key,b);}return b;}
 play(r:SoundRecipe,tick:number,volume:number,priority:number,options:{pan?:number;visible?:boolean;monster?:boolean;thickness?:number}={}){
  if(volume<=0||this.hidden&&this.settings.muteBackground||options.monster&&options.visible===false)return false;
  try{let cancelled=false;const pending:{source:AudioScheduledSourceNode;at:number;end:number}[]=[],a=this.audio(),now=a.currentTime,nodes:AudioNode[]=[],sources:AudioScheduledSourceNode[]=[],stop=()=>{cancelled=true;for(const s of sources)try{s.stop();}catch{}for(const n of nodes)n.disconnect();},sample=this.pick(r),rate=1+(Math.random()-.5)*.08,duration=sample?sample.duration/rate:Math.max(...r.layers.map(l=>l.duration+(l.delay??0)))+(r.echo?.delay??0);
   if(r.bus==='ui'&&now-(this.uiPlayed.get(r.id)??-Infinity)<r.cooldown/30)return false;if(r.bus==='ui')this.uiPlayed.set(r.id,now);
   if(!this.gate.admit(r.id,tick,now,priority,r.bus==='ui'?0:r.cooldown,now+duration,stop,Math.floor(now*60)))return false;if(a.state==='suspended')void a.resume();this.master!.gain.setValueAtTime(this.hidden&&this.settings.muteBackground?0:Math.max(0,Math.min(1,volume)),now);if(priority===soundPriorities.warning||r.id.startsWith('stinger/'))this.duck();
   const pan=a.createStereoPanner();pan.pan.value=Math.max(-.6,Math.min(.6,options.pan??0));const duckTrigger=priority===soundPriorities.warning||r.id.startsWith('stinger/'),eventGain=a.createGain();eventGain.gain.value=(r.gain??1)*(options.monster?.501:1)*(duckTrigger?(r.id.startsWith('stinger/')?this.settings.music:this.settings.effects):1);pan.connect(eventGain).connect(duckTrigger?this.master!:this.buses![r.bus??'combat']);nodes.push(pan,eventGain);
   // Choose all voices from this event batch before starting native sources.
   // A warning arriving after fifty impacts replaces a pending hit, not a 13th sound.
   queueMicrotask(()=>{if(cancelled)return;for(const {source,at,end}of pending){source.start(at);source.stop(end);}});
   const start=(source:AudioScheduledSourceNode,at:number,end:number)=>{sources.push(source);nodes.push(source);pending.push({source,at,end});};
   if(sample){const s=a.createBufferSource(),g=a.createGain();s.buffer=sample;s.playbackRate.value=rate;g.gain.value=Math.pow(10,(Math.random()-.5)*3/20);s.connect(g).connect(pan);nodes.push(g);s.onended=()=>nodes.forEach(n=>n.disconnect());start(s,now,now+duration);return true;}
   const layers=[...r.layers,...Array.from({length:Math.min(2,options.thickness??0)},(_,i)=>({...r.layers[0],from:r.layers[0].from*(1.04+i*.03),weight:r.layers[0].weight*.2}))];let remaining=layers.length;
   for(const l of layers){const at=now+(l.delay??0),end=at+l.duration,gain=a.createGain();nodes.push(gain);gain.gain.setValueAtTime(Math.max(.00001,l.weight*synthGain),at);gain.gain.exponentialRampToValueAtTime(.00001,end);gain.connect(pan);
    if(r.echo){const delay=a.createDelay(),echo=a.createGain();delay.delayTime.value=r.echo.delay;echo.gain.value=r.echo.weight;gain.connect(delay).connect(echo).connect(pan);nodes.push(delay,echo);}
    const source=l.kind==='tone'?a.createOscillator():a.createBufferSource();if(l.kind==='tone'){const o=source as OscillatorNode;o.type=l.type??'sine';o.frequency.setValueAtTime(l.from,at);o.frequency.exponentialRampToValueAtTime(Math.max(1,l.to??l.from),end);o.connect(gain);}else{const s=source as AudioBufferSourceNode,f=a.createBiquadFilter();s.buffer=this.noise(l.duration,Math.round(l.from));f.type=l.filter??'lowpass';f.frequency.value=l.from;s.connect(f).connect(gain);nodes.push(f);}
    if(l.lfo){const o=a.createOscillator(),depth=a.createGain();o.frequency.value=l.lfo.hz;depth.gain.value=l.kind==='tone'?l.lfo.depth:l.weight*synthGain*l.lfo.depth;o.connect(depth).connect(l.kind==='tone'?(source as OscillatorNode).frequency:gain.gain);nodes.push(depth);start(o,at,end);}
    source.onended=()=>{if(--remaining<=0){const cleanup=()=>{for(const n of nodes)n.disconnect();};if(r.echo)setTimeout(cleanup,r.echo.delay*1000);else cleanup();}};start(source,at,end);
   }return true;
  }catch{return false;}
 }
 reset(){this.gate.reset();}
}
