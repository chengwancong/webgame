/** 表现事件总线，不写战斗或持久状态。由正式音频宿主订阅。 */
export type AudioPresentationEvent={kind:'loot-landed'|'loot-picked';id:string;quality?:string};
let listener:((event:AudioPresentationEvent)=>void)|undefined;
export function listenAudioPresentation(next:(event:AudioPresentationEvent)=>void){listener=next;return ()=>{if(listener===next)listener=undefined;};}
export function emitAudioPresentation(event:AudioPresentationEvent){listener?.(event);}
