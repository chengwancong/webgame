import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const source=await read('config/json/tasks.json'),dialogue=await read('config/json/dialogue.json'),chart=await read('packages/content/hub-chart.json');
const regions=['wind','mist','forge','frost','rift','dragon'],edits=new Map(),lines=[],mapping=[];
const update=(id,fields)=>edits.set(id,{...(edits.get(id)??{id}),...fields});
const selections={
 wind:[['z1-1','nest-1','铃铛没有坏，只是被营地的绳索缠住了。羊群听见它，就知道该往家走。'],['z2-1','hunt','小艇的木板还能用，先把守着零件的敌人引开。'],['z4-1','tide','拾荒者把粮袋留在信标后面，等援兵散去就能带人离开。'],['z6-1','treasure','信封上的名字还清楚。把货箱打开，就能知道它该寄给谁。']],
 mist:[['z1-1','nest-1','渡船已经偏离邮路，铃声是船夫认得的最后一个路标。'],['z2-1','nest-2','邮包外层湿透了，里面的封蜡还在。别把寄信人的名字弄丢。'],['z5-1','tide','难民在信标后等待，守住这里，他们才敢走最后一段路。'],['z6-1','treasure','工具柄上刻着工匠的名字，和军需货单上的编号对不上。']],
 forge:[['z1-1','hunt','装载机还在照旧命令运转，后面的工人已经没有退路。'],['z2-1','nest-1','零件不是废料，它们刚好能补上新引擎缺的那一段。'],['z4-1','nest-2','矿道里传来的敲击还没停，先清出一条能让担架通过的路。'],['z6-1','treasure','工程图上的签名没有被刮掉。技师愿意留下，亲手把错误改回来。']],
 frost:[['z2-1','nest-1','日志的日期停在冰封之前，值更人的名字却一直写到了最后。'],['z3-1','nest-2','两面观测镜还指着同一片海，校准它们就能接上断掉的信号。'],['z4-1','hunt','侦察兵在冰隙边留了布条，前面的巡守正在向那里靠近。'],['z5-1','treasure','应答已经迟了很多年，信里的名字仍值得有人认真念出来。']],
 rift:[['z1-1','nest-1','补给箱上的旧货签没被撕掉，里面装的是营地真正需要的东西。'],['z2-1','treasure','药品清单上有几个孩子的名字，先找齐封存的小箱。'],['z4-1','tide','孩子记得母亲留下的记号，守住信标，让她看得见回来的路。'],['z6-1','nest-3','这封信转过好几个哨所。最后一段路，我们替送信的人走完。']],
 dragon:[['z1-1','nest-1','骨碑上的名字和失物对得上，带回去时别把铭刻磨掉。'],['z2-1','tide','火盆边还有旧灰。守住这一轮，下一位应答者就能找到这里。'],['z4-1','hunt','看守机的记忆还剩几段，先停下失控的回路，再把它带回去。'],['z6-1','treasure','米洛在航图边留了一处空白，这一箱记录正好能补上。']]
};
for(const [i,region]of regions.entries()){
 const chapter='ss-c0'+(i+1),regionName=chart.regions.find(r=>r.id===region).name;
 for(const node of chart.nodes.filter(n=>n.region===region))for(const task of node.storyTasks)update(task,{hub_node:node.id,accept_mode:'none',journal:false,auto_track:false,frozen:false});
 if(i>=2){update(chapter+'-n01',{frozen:true,auto_track:false});update(chapter+'-t06',{hub_return:true,journal:false,auto_track:false});}
 const chosen=new Map(selections[region].map(([suffix,node,middle])=>['ow-'+region+'-side-'+suffix,{node:region+'-'+node,middle}]));
 for(const t of source.tasks.filter(t=>t.series==='ow-'+region+'-regional')){
  const selected=chosen.get(t.id),target=selected?.node??region+'-'+(/-z[135]-/.test(t.id)?'nest-1':'tide');
  update(t.id,{hub_node:target,hub_commission:!selected,journal:Boolean(selected),accept_mode:'none',auto_track:false,frozen:!selected,accept_map:'ss-map-port',accept_landmark:'hall',goal:'通关 '+regionName+' · '+chart.nodes.find(n=>n.id===target).name+'。'});
  if(selected){const existing=dialogue.lines.filter(l=>l.group===t.dialog_accept),seq=Math.max(0,...existing.map(l=>l.seq))+1;lines.push({group:t.dialog_accept,seq,speaker:existing[0]?.speaker??t.giver,text:selected.middle});mapping.push({task:t.id,title:t.title,node:target,segment:target.includes('nest')?3:1,dialogueLines:dialogue.lines.filter(l=>[t.dialog_accept,t.dialog_complete].includes(l.group)).length+1});}
 }
 for(const t of source.tasks.filter(t=>t.series==='ow-'+region+'-exploration'))update(t.id,{frozen:true,auto_track:false});
 for(const t of source.tasks.filter(t=>t.series==='ow-'+region+'-dungeon')){const node=region+'-nest-'+t.id.at(-1);update(t.id,{hub_node:node,hub_return:true,journal:false,auto_track:false,accept_mode:'none',frozen:false,goal:'通关 '+regionName+' · '+chart.nodes.find(n=>n.id===node).name+'。'});}
 for(const t of source.tasks.filter(t=>t.type==='bounty'&&t.id.startsWith('ow-'+region+'-')))update(t.id,{goal:t.goal.replace(/在[^，。]*?(击败|击杀|打倒)/,'在'+regionName+'任意节点$1'),accept_map:'ss-map-port',accept_landmark:'post'});
}
await fs.writeFile('.runtime/content-g01/task-plan.json',JSON.stringify({tasks:[...edits.values()],lines},null,2)+'\n');
const bridges=source.tasks.filter(t=>/^ss-c\d+-n\d+$/.test(t.id)&&t.id!=='ss-c01-n01'&&!t.id.endsWith('-n01')).map(t=>({task:t.id,title:t.title,node:edits.get(t.id)?.hub_node??t.hub_node}));
const report=['# C2 任务落位','', '区域支线保留原接取与完成对白，补一条中间线索；不添加交付门槛或箭头。其余区域支线转入委托池，旧探索任务冻结。','', '|任务|故事|节点|段|对白句数|','|---|---|---|---|---|',...mapping.map(m=>`|${m.task}|${m.title}|${m.node}|${m.segment}|${m.dialogueLines}|`),'','## 七条衔接任务','',...bridges.map(b=>`- ${b.task} ${b.title} → ${b.node}，随原地标分段；对白保留在档案，NPC 对话不作为战斗阻塞。`),'','## 章节与回港','',...regions.map((r,i)=>`- ${r}：剧情节点 1/2/3 的开场取原接取对白首句；关口首通回港使用 ss-c0${i+1}-t06:accept，服务端自动确认，前端只取一行。原对白全文保留。`),''];
await fs.writeFile('docs/hub-portal-rework-20261021/handoff/content-c2-task-placement.md',report.join('\n'));
console.log('C2',mapping.length,'side stories;',bridges.length,'bridges;',edits.size,'task patches');
