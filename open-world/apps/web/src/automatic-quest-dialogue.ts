type Quest={id:string;title:string;accept:{speaker:string;text:string}[];step:{map:string}|null};
/** Presentation consumes all accepted server quests, including untracked ones. */
export function automaticQuestDialogues(quests:readonly Quest[],region:string,mode:(id:string)=>string|undefined,seen:ReadonlySet<string>){return quests.filter(q=>['none','arrive'].includes(mode(q.id)??'')&&q.step?.map===region&&!seen.has('accept:'+q.id)&&q.accept.length>0);}
/** HUB 模式对白降级：多句对白只取第一句，变成一行提示（说话人：台词，超长截断）。没有台词时返回 undefined。 */
export function dialogueToastText(lines:readonly {speaker:string;text:string}[],max=40):string|undefined{const first=lines[0];if(!first?.text)return;const text=first.text.length>max?first.text.slice(0,max-1)+'…':first.text;return (first.speaker?first.speaker+'：':'')+text;}
