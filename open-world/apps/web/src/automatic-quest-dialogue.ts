type Quest={id:string;title:string;accept:{speaker:string;text:string}[];step:{map:string}|null};
/** Presentation consumes all accepted server quests, including untracked ones. */
export function automaticQuestDialogues(quests:readonly Quest[],region:string,mode:(id:string)=>string|undefined,seen:ReadonlySet<string>){return quests.filter(q=>['none','arrive'].includes(mode(q.id)??'')&&q.step?.map===region&&!seen.has('accept:'+q.id)&&q.accept.length>0);}
