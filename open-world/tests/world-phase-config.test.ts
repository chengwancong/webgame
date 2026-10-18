import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const files=Object.fromEntries(['world','npcs','tasks','chapters','dialogue'].map(name=>[name+'.json',JSON.parse(readFileSync('config/json/'+name+'.json','utf8'))]));
function check(change:(data:typeof files)=>void){const data=structuredClone(files);change(data);return execFileSync(process.env.AW_PYTHON??'python3',['-X','utf8','-c',"import sys,json;sys.path.insert(0,'tools');from config_quest_check import validate_quest_config;validate_quest_config(json.load(sys.stdin));print('accepted')"],{input:JSON.stringify(data),encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']});}
it('config check rejects an unknown phase condition on every phase-capable world table and NPC positions',()=>{
 for(const table of ['camps','outposts','waypoints','objects','landmarks','gates','merchants'])expect(()=>check(data=>{data['world.json'][table]??=[];data['world.json'][table].push({id:'unknown-phase',when:'missing-phase-target'});})).toThrow('世界相位条件不存在');
 expect(()=>check(data=>{data['npcs.json'].positions=[{id:'unknown-npc-phase',when:'missing-phase-target'}];})).toThrow('人物相位条件不存在');
},20000);
it('config check rejects overlapping NPC positions and accepts complementary when/until or non-overlapping level intervals',()=>{
 const setup=(data:typeof files)=>{data['tasks.json'].conditions.push({_row:999,target:'position-after',group:1,kind:'level',value:'5',path:'fallback'});const npc=data['npcs.json'].npcs[0];data['npcs.json'].positions=[{_row:4,id:'position-one',npc:npc.id,map:npc.home_map,x:npc.x,y:npc.y,until:'position-after'},{_row:5,id:'position-two',npc:npc.id,map:npc.home_map,x:npc.x+10,y:npc.y,when:'position-after'}];};
 expect(check(setup)).toContain('accepted');
 expect(()=>check(data=>{setup(data);delete data['npcs.json'].positions[0].until;})).toThrow('人物站位同时可见');
 expect(check(data=>{setup(data);data['tasks.json'].conditions.push({_row:1000,target:'position-before',group:1,kind:'level',value:'5',path:'fallback'});data['npcs.json'].positions[0].until='position-before';})).toContain('accepted');
});
