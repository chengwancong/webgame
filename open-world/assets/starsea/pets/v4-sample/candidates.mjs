import {join} from 'node:path';import {writeFile} from 'node:fs/promises';import {boot,load,render,group,json,record,sharp,pixels} from './pipeline.mjs';
const rows=[
 ['风栖','C8','羽翼逐阶展开，鸟类轮廓清楚；可用浅羽色与风色翼纹。'],['风栖','A7','角冠、长鳍和后期翼膜形成明显高档剪影。'],
 ['雾铃','A3','花角与鬃毛适合雾林，后期角冠可承接铃饰。'],['雾铃','B1','长鳍尾与层叠冠适合潮湿幻兽，米绿底色可减弱海洋感。'],
 ['赤炉','A7','长角、分层鳍翼适合余烬与锻金饰甲。'],['赤炉','A10','翼龙轮廓清楚，宽翼可承接炉纹与金属镶边。'],
 ['霜镜','S9','长鳍与流线鱼身适合冰晶片层，保持圆眼即可。'],['霜镜','A3','鹿角与鬃毛适合霜花，角冠空间充足。'],
 ['龙眠','A7','本批实测 c/d/e：长角冠、翼膜与长尾能支撑两种精绘。'],['龙眠','B1','觉醒龙海马形态明显，冠鳍与卷尾有独立装饰空间。'],
 ['沉星','A7','长角与鳍翼可承接星辉分片，尾部适合星尘粒子。'],['沉星','A3','花角可重画成星枝，鬃毛与长尾仍保留轻盈灵兽轮廓。']
];
const ctx=await boot(),rendered=new Map(),checks=[];
try{for(const family of new Set(rows.map(r=>r[1])))for(const stage of ['c','d','e']){
 const info=await load(ctx,family,stage),sample=await render(ctx,'idle',0),b=sample.bounds,camera={cell:320,span:Math.max(b.maxX-b.minX,b.maxY-b.minY)*1.12,cx:(b.minX+b.maxX)/2,cy:(b.minY+b.maxY)/2};
 const buf=Buffer.from((await render(ctx,'idle',0,camera)).png.split(',')[1],'base64'),box=await pixels(buf),crop=await sharp(buf).extract({left:box.x,top:box.y,width:box.w,height:box.h}).resize({width:160,height:148,fit:'inside'}).png().toBuffer();
 rendered.set(family+stage,crop);const actionChecks=[];for(const action of ['idle','idle2','move','attack','knock']){const m=info.actions[action];if(!m){actionChecks.push(action+':无');continue;}for(const t of [0,m.duration*.5,m.duration*.9]){const f=await render(ctx,action,t,camera);if(!Object.values(f.bounds).every(Number.isFinite))throw Error('Candidate nonfinite');}actionChecks.push(action);}
 checks.push({family,stage,version:info.version,gpu:info.gpu,actions:actionChecks,source:await record(join(info.dir,info.name+'.json'))});console.log('candidate',family,stage,'assembled, five-action probe OK');
}}finally{await ctx.close();}
const width=1280,height=100+rows.length*190,tiles=[],labels=[];
labels.push('<text x="35" y="40" font-size="26">PA5 · 六岛重氪家族候选</text><text x="35" y="72" font-size="15">原生 c / d / e 拼装渲染 · 每岛两候选 · 推荐 c/d/e；只评家族，不替用户选择 A/B 画法</text>');
for(const [i,[island,family,reason]]of rows.entries()){
 const y=100+i*190;labels.push(`<rect x="20" y="${y}" width="1240" height="180" rx="10" fill="${i%2?'#f1ecdf':'#fffdf6'}"/><text x="40" y="${y+42}" font-size="23">${island} · ${family}</text><text x="40" y="${y+74}" font-size="16">推荐 c / d / e${family==='C8'?' · d 阶缺原生受击，候补':''}</text><text x="40" y="${y+110}" font-size="14">${reason}</text>`);
 for(const [j,stage]of ['c','d','e'].entries()){const buf=rendered.get(family+stage),m=await sharp(buf).metadata();tiles.push({input:buf,left:700+j*180+Math.round((160-m.width)/2),top:y+10+148-m.height});labels.push(`<text x="${780+j*180}" y="${y+174}" text-anchor="middle" font-size="15">${family}${stage}</text>`);}
}
await sharp({create:{width,height,channels:4,background:'#e9e3d4'}}).composite([{input:Buffer.from(`<svg width="${width}" height="${height}"><g font-family="Microsoft YaHei" fill="#293940">${labels.join('')}</g></svg>`),left:0,top:0},...tiles]).png().toFile(join(group,'evidence/heavy-candidates.png'));
await json(join(group,'evidence/candidates-validation.json'),{rows,checks,pass:true});
await writeFile(join(group,'candidates.md'),'# 六岛候选\n\n|岛|家族|推荐阶段|理由|\n|---|---|---|---|\n'+rows.map(r=>`|${r[0]}|${r[1]}|c/d/e|${r[2]}|`).join('\n')+'\n\n均已在可视 Chrome 的 Spine 3.6 运行时拼装 c/d/e，并抽查五动作。候选阶段共用原库贴图，只用于评估轮廓；最终需按 PA5 重画五官、色面。\n');
