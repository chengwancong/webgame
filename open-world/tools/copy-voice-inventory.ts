// 导出玩家可见文案盘点：pnpm tsx tools/copy-voice-inventory.ts → docs/reviews/copy-voice-20261009/inventory.md
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {report,root} from './copy-voice-scan.ts';
const r=report(),out=resolve(root,process.env.AW_COPY_REVIEW_DIR??'docs/reviews/copy-voice-20261009');mkdirSync(out,{recursive:true});
const esc=(s:string)=>s.replaceAll('|','\\|').replaceAll('\n',' ');
const byGroup=new Map<string,typeof r.entries>();for(const e of r.entries)byGroup.set(e.group,[...(byGroup.get(e.group)??[]),e]);
const lines=[`# 玩家可见文案盘点`,``,`生成：${new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium',hour12:false}).format(new Date())} (Asia/Shanghai)。条目 ${r.entries.length}，禁用词命中 ${r.bannedHits.length}，超长 ${r.overLimit.length}。`,``,`## 各界面统计`,``,`| 界面 | 条目 | 禁用词命中 | 超长 |`,`|---|---|---|---|`];
for(const [g,list] of [...byGroup].sort((a,b)=>b[1].length-a[1].length))lines.push(`| ${g} | ${list.length} | ${r.bannedHits.filter(e=>e.group===g).length} | ${r.overLimit.filter(e=>e.group===g).length} |`);
lines.push('',`## 禁用词命中`,'','| 界面 | 位置 | 命中 | 文案 |','|---|---|---|---|');
for(const e of [...r.bannedHits].sort((a,b)=>a.group.localeCompare(b.group)||a.file.localeCompare(b.file)))lines.push(`| ${e.group} | ${e.file}:${e.line} | ${e.words.join('、')} | ${esc(e.text).slice(0,160)} |`);
lines.push('',`## 超长（按钮 6 / HUD 14 / Toast 18 / 配方用途 30）`,'','| 界面 | 位置 | 类型 | 字数 | 文案 |','|---|---|---|---|---|');
for(const e of r.overLimit)lines.push(`| ${e.group} | ${e.file}:${e.line} | ${e.kind} | ${e.chars}/${e.limit} | ${esc(e.text)} |`);
lines.push('',`## 全部条目（按界面）`,'');
for(const [g,list] of byGroup){lines.push(`### ${g}`,'','| 来源 | 位置 | 类型 | 文案 |','|---|---|---|---|');for(const e of list)lines.push(`| ${e.source} | ${e.file}:${e.line} | ${e.kind} | ${esc(e.text).slice(0,200)} |`);lines.push('');}
writeFileSync(resolve(out,'inventory.md'),lines.join('\n'));
console.log(JSON.stringify({entries:r.entries.length,banned:r.bannedHits.length,overLimit:r.overLimit.length,groups:Object.fromEntries([...byGroup].map(([g,l])=>[g,[l.length,r.bannedHits.filter(e=>e.group===g).length]]))}));
