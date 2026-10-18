// 玩家可见文案扫描（docs/ui-copy-voice.md §6）：客户端正式入口依赖图里的中文字面量、
// config/json 玩家可见字段、服务端返回给界面的错误文案。只读源码，不改任何内容。
import ts from 'typescript';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import allowRaw from './copy-voice-allowlist.json';
export type AllowTerm={term:string;reason:string};
export type AllowLength={text:string;reason:string};
/** Typed so the scanner keeps compiling while the allowlist is still empty. */
export const allow:{terms:AllowTerm[];lengthExceptions:AllowLength[]}=allowRaw as unknown as {terms:AllowTerm[];lengthExceptions:AllowLength[]};
export const root=resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1')),'..');
export type CopyKind='button'|'hud'|'toast'|'description'|'text';
export type CopyEntry={source:'client'|'config'|'server';file:string;line:number;text:string;kind:CopyKind;group:string};
/** §3 禁用词。正则只在含中文的文字里匹配。 */
export const banned:{word:string;re:RegExp}[]=[
 ['造型',/造型/],['亲和',/亲和/],['T1/T2/T3',/\bT[123]\b/i],
 ['阶段',/阶段/],['stage',/stage/i],['构筑',/构筑/],['BD',/\bBD\b/],['build',/\bbuild\b/i],
 ['冻结',/冻结/],['快照',/快照/],['解析',/解析/],['执行器',/执行器/],['回执',/回执/],['流水',/流水/],['事件记录',/事件记录/],
 ['权重',/权重/],['保底',/保底/],['来源表',/来源表/],['随机表',/随机表/],['倍率',/倍率/],['系数',/系数/],
 ['输出秒数',/输出秒数/],['有效输出',/有效输出/],['占比',/占比/],['DPS',/DPS/i],['秒伤',/秒伤/],
 ['适配',/适配/],['取舍',/取舍/],['同强化对比',/同强化/],['产物',/产物/],['相对',/相对/],['×N',/[×x]\s*\d+(\.\d+)?(?![\d级])/],
 ['机制方向',/机制方向/],['阶段用途',/阶段用途/],['部位：',/部位[:：]/],['实时作战',/实时作战/],['1至1人',/(\d|\{…\})至(\d|\{…\})人/],
 // 只拦人数区间这种“整段就是 a–b 人”的写法；“3–20 格”“Lv1–150”“38–41”是正常的取值范围说明。
 ['1–1',/^\s*(?:1\s*[–-]\s*1|(?:\d+|\{…\})\s*[–-]\s*(?:\d+|\{…\})\s*人)\s*$/],
 ['之后新刷出的营地生效',/新刷出的营地/],['普通随机传说',/普通随机/],['原初主手',/原初主手/],['处理中',/处理中/],['请求中',/请求中/],
 ['服务端',/服务端/],['客户端',/客户端/],['配置',/配置/],['难度修正',/难度修正/],['额外难度',/额外难度/],['准入等级',/准入等级/],['世界层级',/世界层级/],
].map(([word,re])=>({word:word as string,re:re as RegExp}));
export const limits:Record<Exclude<CopyKind,'text'>,number>={button:6,hud:14,toast:18,description:30};
const han=/[\u4e00-\u9fff]/;
/** 字数：汉字与全角标点各算 1，连续的数字/字母串算 1，空白与插值占位不算。 */
export const length=(s:string)=>s.replace(/\$\{…\}/g,'').replace(/[A-Za-z0-9.+\-/%]+/g,'#').replace(/\s/g,'').length;
const allowed=new Set(allow.terms.map(t=>t.term));
export function hits(text:string){let clean=text;for(const t of allowed)clean=clean.replaceAll(t,'');return banned.filter(b=>b.re.test(clean)).map(b=>b.word);}
// 只跳过开发者用的异常与日志；ProgressionError/StarseaError/AppearanceError/Fault/fail 会原样显示给玩家。
const internalCalls=/^(console\.\w+|Error|TypeError|RangeError|SyntaxError|log\.\w+|req\.log\.\w+|app\.log\.\w+|assert\w*|describe|it|test|expect)$/;
const visibleAttr=/\b(title|aria-label|placeholder|alt)="([^"]*)"/g;
/** 拆成玩家看到的片段：标签之间的文字 + 可读属性；插值记为 {…}。 */
function segments(text:string){
 const out:string[]=[];
 for(const m of text.matchAll(/<[^>]*>/g))for(const a of m[0].matchAll(visibleAttr))out.push(a[2]);
 out.push(...text.replace(/<[^>]*>/g,'\n').split('\n'));
 return out.map(s=>s.trim()).filter(s=>han.test(s)||/(\d|\{…\})\s*–\s*(\d|\{…\})/.test(s));
}
function literalText(node:ts.Node):string|undefined{
 if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
 if(ts.isTemplateExpression(node))return node.head.text+node.templateSpans.map(s=>'{…}'+s.literal.text).join('');
}
function callName(n:ts.CallExpression|ts.NewExpression){return n.expression.getText().replace(/^this\.(deps\.)?/,'');}
function scanTs(file:string,source:CopyEntry['source']):CopyEntry[]{
 const text=readFileSync(file,'utf8'),sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true),out:CopyEntry[]=[],rel=relative(root,file).replaceAll('\\','/');
 const hudFile=/(^|\/)(hud-[\w-]+|objective|quest-guide|field-controller|minimap)\.ts$/.test(rel),devOnlyFile=/^packages\/(content|contracts)\//.test(rel);
 const visit=(node:ts.Node,kind:CopyKind,skip:boolean)=>{
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))return;
  // 内容/契约模块里的 throw 与 schema refine 是加载期校验，只给开发者看。
  if(devOnlyFile&&(ts.isThrowStatement(node)))skip=true;
  if((ts.isCallExpression(node)||ts.isNewExpression(node))){
   const name=callName(node),first=node.arguments?.[0];
   if(internalCalls.test(name)||/(^|\.)(refine|superRefine|addIssue)$/.test(name)||(first&&ts.isStringLiteral(first)&&first.text==='CONTENT')||(devOnlyFile&&/^(fail|reject|bad)$/.test(name))){skip=true;}
   else if(/(^|\.)buttonHtml$/.test(name)&&node.arguments?.[0]){visit(node.expression,kind,skip);visit(node.arguments[0],'button',skip);node.arguments.slice(1).forEach(a=>visit(a,kind,skip));return;}
   else if(/(^|\.)notice$/.test(name)&&node.arguments?.[0]){visit(node.arguments[0],'toast',skip);return;}
  }
  if(ts.isElementAccessExpression(node)){visit(node.expression,kind,skip);return;}
  const value=literalText(node);
  if(value!==undefined&&!skip&&(han.test(value)||/^T[123]$/i.test(value)||/–/.test(value))){
   const line=sf.getLineAndCharacterOfPosition(node.getStart()).line+1;
   for(const s of segments(value))out.push({source,file:rel,line,text:s,kind:kind==='text'&&hudFile?'hud':kind,group:groupOf(rel)});
  }
  ts.forEachChild(node,c=>visit(c,kind,skip));
 };
 visit(sf,'text',false);return out;
}
const groups:[RegExp,string][]=[
 [/battle-result|dungeon-diagnostic|combat-review|defeat|result/,'结算/失败页'],[/world-tier|sea-difficulty/,'海域难度'],[/dungeon/,'副本目录'],
 [/stage-key/,'钥匙配方'],[/equipment|item-tip|gear|compare/,'装备对比/Tips'],[/bag|inventory|camp-sort/,'背包整理'],
 [/travel|starsea|chart|region-map|minimap/,'航图/地图'],[/hud|objective|quest-guide|field/,'HUD 引导'],[/task|quest|story|dialogue|npc/,'任务/NPC'],
 [/skill/,'技能'],[/progression|talent|paragon/,'天赋/养成'],[/setting|login|auth|account/,'设置/登录'],[/apps\/api|packages\/rules/,'服务端提示'],
];
export function groupOf(file:string){return groups.find(([re])=>re.test(file))?.[1]??'通用界面';}
/** 正式游戏入口（index.html → main.ts）的相对导入闭包；预览页、QA 页不在其中。 */
export function clientFiles(){
 const seen=new Set<string>(),json=new Set<string>(),queue=[resolve(root,'apps/web/src/main.ts')];
 while(queue.length){const file=queue.pop()!;if(seen.has(file))continue;seen.add(file);
  const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const specs:string[]=[];sf.forEachChild(function walk(n){if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier)&&!(ts.isImportDeclaration(n)&&n.importClause?.isTypeOnly))specs.push(n.moduleSpecifier.text);if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&ts.isStringLiteral(n.arguments[0]))specs.push(n.arguments[0].text);n.forEachChild(walk);});
  for(const spec of specs){if(!spec.startsWith('.'))continue;const target=resolve(dirname(file),spec.replace(/\?.*$/,''));if(target.endsWith('.json')){json.add(target);continue;}if(target.endsWith('.ts')&&existsSync(target)&&!/[\\/]content[\\/]open-world[\\/]/.test(target))queue.push(target);}
 }
 return {ts:[...seen],json:[...json]};
}
/** config/json 与客户端导入的内容 JSON 里玩家能看到的字段。 */
export const visibleKeys=new Set(['name','title','label','goal','note','note_ready','goal_ready','goal_final','summary','story','hint','line','text','description','reason','starsea_reason','feature_text','reveal','choice_after','unlock_message','boss_line','ready_objective','ready_line','risk','short','role','voice','service_label','verb','hint_verb','opened_message','message','objective','area','place','island','tooltip','detail','dropHint']);
function scanJson(file:string):CopyEntry[]{
 // Designer targets are not player copy. The isolated lab has its own visible labels and GUI scan.
 if(file.replaceAll('\\','/').endsWith('/config/json/pacing-targets.json'))return [];
 const rel=relative(root,file).replaceAll('\\','/'),lines=readFileSync(file,'utf8').split('\n'),out:CopyEntry[]=[];
 const lineOf=(s:string)=>{const needle=JSON.stringify(s).slice(1,-1);const i=lines.findIndex(l=>l.includes(needle));return i+1;};
 const walk=(v:unknown,key:string)=>{if(typeof v==='string'){if(visibleKeys.has(key)&&han.test(v))out.push({source:'config',file:rel,line:lineOf(v),text:v,kind:rel==='apps/api/src/stage-key-pools.json'&&key==='description'?'description':'text',group:/tasks|dialogue|npcs|chapters|props/.test(rel)?'任务/NPC':groupOf(rel)});}else if(Array.isArray(v))v.forEach(x=>walk(x,key));else if(v&&typeof v==='object')for(const [k,x] of Object.entries(v))walk(x,k);};
 const data=JSON.parse(readFileSync(file,'utf8'));
 // The prologue renders card copy and skill names. Its frozen grant contains
 // internal resolved stats/effect descriptions, which never appear in the UI.
 if(rel==='packages/content/starsea/prologue.json')for(const family of Object.values(data.families) as any[]){
  family.granted={skills:family.granted.skills.map((skill:{name:string})=>({name:skill.name}))};
  family.burst={name:family.burst.name};
 }
 walk(data,'');return out;
}
const tsUnder=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?tsUnder(resolve(dir,d.name)):d.name.endsWith('.ts')&&!d.name.endsWith('.test.ts')?[resolve(dir,d.name)]:[]);
export function collect():CopyEntry[]{
 const client=clientFiles(),done=new Set(client.ts),out=client.ts.flatMap(f=>scanTs(f,'client'));
 for(const f of [...tsUnder(resolve(root,'apps/api/src')),...tsUnder(resolve(root,'packages/rules'))])if(!done.has(f))out.push(...scanTs(f,'server'));
 const configs=readdirSync(resolve(root,'config/json')).map(f=>resolve(root,'config/json',f));
 // 资源清单（asset-manifest）里的 note 是美术接入记录，不进入界面。
 for(const f of new Set([...configs,...client.json,resolve(root,'apps/api/src/stage-key-pools.json')]))if(!/[\\/]asset-manifest[\\/]/.test(f))out.push(...scanJson(f));
 return out;
}
export function report(entries=collect()){
 const bannedHits=entries.map(e=>({...e,words:hits(e.text)})).filter(e=>e.words.length);
 const overLimit=entries.filter(e=>e.kind!=='text'&&length(e.text)>limits[e.kind]&&!allow.lengthExceptions.some(x=>x.text===e.text)).map(e=>({...e,limit:limits[e.kind as keyof typeof limits],chars:length(e.text)}));
 return {entries,bannedHits,overLimit};
}
