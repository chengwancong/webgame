// 收获流水（#feed）：连续战报的金币/经验合并成一行，整行数秒后淡出，避免三行同样的“获得 X 金币”一直叠在屏上（Grok 第四轮：Toast 叠层）。
export const FEED_LIMIT=3;
export const FEED_TTL=6000;
export const GAIN_MERGE_MS=4000;
type Row={text:string;at:number;gain?:{gold:number;xp:number}};
const gainText=(g:{gold:number;xp:number})=>`获得 ${g.gold} 金币 · ${g.xp} 经验`;

export class FeedLog{
 private rows:Row[]=[];
 /** 最新一行仍是数秒内的收获时累加到同一行，否则新起一行。 */
 gain(gold:number,xp:number,now:number){
  const top=this.rows[0];
  if(top?.gain&&now-top.at<GAIN_MERGE_MS){top.gain.gold+=gold;top.gain.xp+=xp;top.text=gainText(top.gain);top.at=now;}
  else this.rows.unshift({text:gainText({gold,xp}),at:now,gain:{gold,xp}});
  this.rows=this.rows.slice(0,FEED_LIMIT);
 }
 push(text:string,now:number){this.rows.unshift({text,at:now});this.rows=this.rows.slice(0,FEED_LIMIT);}
 /** 新在上；超过 FEED_TTL 的行在这里移除。 */
 visible(now:number):string[]{this.rows=this.rows.filter(r=>now-r.at<FEED_TTL);return this.rows.map(r=>r.text);}
 clear(){this.rows=[];}
}
