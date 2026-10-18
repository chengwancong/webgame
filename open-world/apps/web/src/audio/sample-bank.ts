import manifest from './sample-manifest.json';
// 由 tools/audio/build.py 生成：key → 阶段 → 变体文件。wired=false 的条目已制作但尚未接入触发点。
type Entry={files:string[];formats?:{ogg?:string[];opus?:string[];aac?:string[]};tier:string;wired:boolean;source:string;license:string;note:string};
const bank=manifest as Record<string,Record<string,Entry>>;
// 运行时优先加载压缩版（tools/audio/compress.py 生成的 Ogg Vorbis），不支持时回退 WAV 源文件。
let playable:{ogg:boolean;opus:boolean;aac:boolean}|undefined;
const support=()=>{if(playable)return playable;if(typeof Audio==='undefined')return {ogg:false,opus:false,aac:false};const probe=new Audio();return playable={ogg:!!probe.canPlayType('audio/ogg; codecs="vorbis"'),opus:!!probe.canPlayType('audio/ogg; codecs=opus'),aac:!!probe.canPlayType('audio/mp4')};};
const runtimeFiles=(e:Entry)=>{const f=e.formats;if(f){const s=support();if(s.ogg&&f.ogg)return f.ogg;if(s.opus&&f.opus)return f.opus;if(s.aac&&f.aac)return f.aac;}return e.files;};
export const wiredSamples=(key:string,stage:string)=>{const e=bank[key]?.[stage];if(!e?.wired||!e.files.length)return undefined;return runtimeFiles(e);};
export const allWiredSamples=()=>Object.values(bank).flatMap(stages=>Object.values(stages).filter(e=>e.wired).flatMap(runtimeFiles));

export const sampleBank=bank;
export const preloadSamples=(skills:readonly string[]=[])=>Object.entries(bank).filter(([key])=>/^(cue|foley|ui)\//.test(key)||skills.some(id=>key==='player/'+id)).flatMap(([key,stages])=>Object.keys(stages).flatMap(stage=>wiredSamples(key,stage)??[]));
