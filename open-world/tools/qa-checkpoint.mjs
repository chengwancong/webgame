// 本地验收检查点：把一个 qa_ 测试号的新角色直接推到某个任务节点，再在可视浏览器里用同一账号登录。
// 用法：node tools/qa-checkpoint.mjs <qa_账号> <landing|salvage|port-road> <sword|staff|hidden> [http://127.0.0.1:8612]
// 只对开发服生效（AW_DEV_CHECKPOINTS / testLogin），账号必须以 qa_ 开头，角色必须还没打开场。
import {randomUUID} from 'node:crypto';
const [username,checkpoint,weapon,base='http://127.0.0.1:8612']=process.argv.slice(2);
if(!username?.startsWith('qa_')||!checkpoint||!weapon){console.error('用法：node tools/qa-checkpoint.mjs <qa_账号> <landing|salvage|port-road> <sword|staff|hidden> [地址]');process.exit(2);}
let cookie='';
async function call(path,body){
 const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];
 const json=await r.json().catch(()=>({}));return {status:r.status,body:json};
}
const fail=(step,r)=>{console.error(step+' 失败：',r.status,JSON.stringify(r.body));process.exit(1);};
let r=await call('session/login',{username});if(r.status!==200)fail('登录',r);
r=await call('character');if(r.status===404){r=await call('character',{name:username.slice(0,12)});if(r.status!==200)fail('建角',r);}else if(r.status!==200)fail('读取角色',r);
let s=r.body;
const control=await call('control',{client_id:randomUUID()});if(control.status!==200)fail('取得控制权',control);
r=await call('dev/checkpoint',{command_id:randomUUID(),revision:s.revision,lease_id:control.body.lease_id,checkpoint,weapon});if(r.status!==200)fail('跳检查点',r);
s=r.body.snapshot;
console.log(JSON.stringify({username,checkpoint,weapon,level:s.level,skills:s.skills,done:s.starsea?.done,quests:Object.keys(s.starsea?.quests??{}),tracked:s.starsea?.tracked},null,1));
