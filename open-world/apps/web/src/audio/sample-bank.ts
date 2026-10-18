import manifest from './sample-manifest.json';
// 由 tools/audio/build.py 生成：key → 阶段 → 变体文件。wired=false 的条目已制作但尚未接入触发点。
type Entry={files:string[];formats?:{opus?:string[];aac?:string[]};tier:string;wired:boolean;source:string;license:string;note:string};
const bank=manifest as Record<string,Record<string,Entry>>;
export const wiredSamples=(key:string,stage:string)=>{const e=bank[key]?.[stage];if(!e?.wired||!e.files.length)return undefined;if(e.formats&&typeof Audio!=='undefined'){const probe=new Audio();if(probe.canPlayType('audio/ogg; codecs=opus')&&e.formats.opus)return e.formats.opus;if(probe.canPlayType('audio/mp4')&&e.formats.aac)return e.formats.aac;}return e.files;};
export const allWiredSamples=()=>Object.values(bank).flatMap(stages=>Object.values(stages).filter(e=>e.wired).flatMap(e=>e.files));

export const sampleBank=bank;
export const preloadSamples=(skills:readonly string[]=[])=>Object.entries(bank).filter(([key])=>/^(cue|foley|ui)\//.test(key)||skills.some(id=>key==='player/'+id)).flatMap(([key,stages])=>Object.keys(stages).flatMap(stage=>wiredSamples(key,stage)??[]));
