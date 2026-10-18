// 从已确认的星潮海设计（docs/starsea/requirements.json）抽取运行时需要的剧情与角色字段。
// 运行：node tools/build-starsea-campaign.mjs → packages/content/starsea/campaign.json
import {readFile,writeFile} from 'node:fs/promises';
const source=JSON.parse(await readFile(new URL('../docs/starsea/requirements.json',import.meta.url),'utf8'));
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const out={
 version:source.version,campaignId:source.campaignId,title:source.title,
 npcs:source.npcs.map(n=>pick(n,['id','name','role','voice'])),
 monsters:source.monsters.map(m=>pick(m,['id','name','chapter','rank','rule','role','height'])),
 bosses:source.bosses.map(b=>pick(b,['id','name','chapter','base','skills','height'])),
 chapters:source.chapters.map(c=>({...pick(c,['n','id','title','island','map','giver','ally','feature','reveal','choice']),tasks:c.tasks.map(t=>pick(t,['id','title','kind','goal','speaker','accept','player','complete','landmark','required','requires','completionEvent','locationMap','resources']))})),
};
await writeFile(new URL('../packages/content/starsea/campaign.json',import.meta.url),JSON.stringify(out,null,1)+'\n');
console.log('chapters',out.chapters.length,'tasks',out.chapters.reduce((n,c)=>n+c.tasks.length,0));
