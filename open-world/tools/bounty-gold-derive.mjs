// 悬赏金币推导（P55）：金币 = 0.5 × 该悬赏预期击杀金币（与 bountyXpShare 同口径）。
// 用法：node tools/bounty-gold-derive.mjs [--json]
import fs from 'node:fs';
const t=JSON.parse(fs.readFileSync(new URL('../config/json/tasks.json',import.meta.url),'utf8')).tasks;
const w=JSON.parse(fs.readFileSync(new URL('../config/json/world.json',import.meta.url),'utf8')).zones;
const share=.5,gold=(L,elite)=>6*1.09**(L-1)*(elite?3:1);
const out=[];
for(const r of t.filter(x=>x.type==='bounty'&&x.id.startsWith('ow-'))){
 const z=w.find(x=>x.id===r.zone),L=Math.round((z.levelBand[0]+z.levelBand[1])/2);
 const per=gold(L,false),n=r.elite?10:r.cond_count; // 精英单只悬赏按 10 只普通怪折算
 const next=Math.max(r.reward_gold,Math.round(share*per*n/10)*10); // 不低于现值（不靠降收益）
 out.push({id:r.id,zone:r.zone,level:L,count:n,elite:!!r.elite,cur:r.reward_gold,next,killGold:Math.round(gold(L,r.elite)*r.cond_count)});
}
// P55-R01（10-21 裁决）：同岛同档 z1→z6 单调上包络——真实等级回落（雾铃 z2 Lv11→z3 Lv10）时取前一区值，不改怪等级/系数。
const lanes={};for(const o of out){const m=o.id.match(/^ow-(\w+)-bounty-z(\d)-(\d)$/);if(m)(lanes[m[1]+':'+m[3]]??=[]).push([Number(m[2]),o]);}
for(const lane of Object.values(lanes)){lane.sort((a,b)=>a[0]-b[0]);for(let i=1;i<lane.length;i++)lane[i][1].next=Math.max(lane[i][1].next,lane[i-1][1].next);}
if(process.argv.includes('--json'))console.log(JSON.stringify(out,null,1));
else for(const o of out.filter(o=>o.id.endsWith('-1')||o.id.endsWith('-2')||o.id.endsWith('-3')))console.log(o.id.padEnd(24),'Lv'+o.level,'x'+o.count,o.elite?'elite':'norm ','kills≈'+o.killGold,'cur',o.cur,'→',o.next);
