import manifest from './music-manifest.json';
// 由 tools/audio/music.py 生成：music/<key> → [ogg, mp3]。原曲为 OpenGameArt CC0，出处见清单 source/author。
type Track={files:string[];seconds:number;seamless:boolean;source:string;author:string;license:string};
const tracks=manifest as Record<string,Track>;
let ogg:boolean|undefined;
const oggPlayable=()=>ogg??=typeof Audio!=='undefined'&&!!new Audio().canPlayType('audio/ogg; codecs="vorbis"');
/** 优先 .ogg（浏览器循环无缝），不支持时回退 .mp3。 */
export const musicUrl=(key:string)=>{const files=tracks[key]?.files;if(!files)return undefined;return files.find(f=>f.endsWith(oggPlayable()?'.ogg':'.mp3'))??files[0];};
export const musicTracks=tracks;
