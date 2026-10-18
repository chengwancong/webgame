import {it,expect} from 'vitest';
import {stageKeyPreviewHtml} from '../apps/web/src/stage-key-preview.ts';
import {stageKeyHtml} from '../apps/web/src/stage-key-view.ts';
import {combatKeyProgressHtml,combatAdviceDestination} from '../apps/web/src/combat-review-view.ts';
import {hudGoalLabel,questTrackerHtml} from '../apps/web/src/hud-context.ts';
import {battleResultHtml} from '../apps/web/src/battle-result-panel.ts';
import {validateResponse,type TaskView} from '../packages/contracts/index.ts';
import type {GrowthPreview,StageKeyPreview,StageKeyProgress} from '../packages/contracts/index.ts';
import {hits} from '../tools/copy-voice-scan.ts';
import keyPools from '../apps/api/src/stage-key-pools.json';

it('every server recipe has a short player-facing purpose',()=>{
 for(const pool of keyPools.pools)for(const choice of [...pool.choices,...(pool.endgameChoices??[])]){
  expect([...choice.description].length,choice.id).toBeLessThanOrEqual(30);
  expect(hits(choice.description),choice.id).toEqual([]);
 }
});

it('each recipe slot retains its own comparison rank',()=>{
 const preview={revision:0,scope:'stage:3',stage:3,key:'test',name:'船坞护具',description:'做出护具，让你更耐打。',outputSlots:['armor','head'],products:[],growth:[],changes:[],note:'做出来后回港换上。',alignments:[{slot:'armor',rank:7,currentRank:7,productRank:0},{slot:'head',rank:3,currentRank:3,productRank:0}]} as StageKeyPreview;
 const html=stageKeyPreviewHtml(preview);
 expect(html).toContain('按同样 +7 比较');expect(html).toContain('按同样 +3 比较');expect(html).toContain('制作后详情');expect(html).toContain('你现在用的是 +7，做出来的是 +0');
 expect(hits(html.replace(/<[^>]+>/g,''))).toEqual([]);
});
it('recipe and settlement use the same named fragment and real counts',()=>{
 const progress={scope:'stage:4',stage:4,dungeon:'field-mist-1',materials:73,required:60,obtained:false,choices:[]} as StageKeyProgress;
 for(const html of [stageKeyHtml(progress),combatKeyProgressHtml(progress,'雾铃树穴')]){
  expect(html).toContain('雾铃树穴钥匙碎片');expect(html).toContain('73 / 60');
  expect(html).toContain('精英、稀有敌人和宝箱会掉');
 }
});
it('a successful settlement retains its key progress and both next actions',()=>{
 const progress={scope:'stage:4',stage:4,dungeon:'field-mist-1',materials:7,required:60,obtained:false,choices:[]} as StageKeyProgress;
 const data={success:true,gear:[],materials:{},books:{},totals:{gold:4,xp:2,material:1},unlocked_regions:[],delivery:'inventory',history_complete:true} as any;
 const html=battleResultHtml({region:'meadow',outcome:'success',keyStage:4},data,'ready','拾星港','',false,0,undefined,progress);
 expect(html).toContain('钥匙进度');expect(html).toContain('雾铃树穴钥匙碎片');expect(html).toContain('7 / 60');
 expect(html).toContain('data-action="result-retry"');expect(html).toContain('data-action="result-return"');
 expect(html).not.toContain('你倒在了这里');expect(html).not.toContain('试试这样做');
});
it('the copy scanner catches the bare single-player range without rejecting level bands',()=>{
 expect(hits('1–1')).toContain('1–1');expect(hits('1–4 人')).toContain('1–1');
 expect(hits('38–41')).toEqual([]);expect(hits('Lv1–150')).toEqual([]);
});
it('response validation retains the server equipment verdict',()=>{
 const id='00000000-0000-4000-8000-000000000001',stats={hp:100,attack:20,armor:10,speed:6,mana:100,regen:5,effects:[]},build={stats,resolvedSkills:[]};
 const value=validateResponse('gear/'+id+'/preview',{verdict:'output',gear_id:id,revision:1,ruleset_version:'test',cost:{gold:0,material:0},current:build,equipped:build,upgraded:build,max:false,salvage:{gear_id:id,material:1,allowed:true,blocked:''}}) as GrowthPreview;
 expect(value.verdict).toBe('output');
});
it('armor and weapon advice select the actual intended forge slot',()=>{
 expect(combatAdviceDestination('forge:armor')).toEqual({action:'advice-forge',id:'armor'});
 expect(combatAdviceDestination('forge:weapon')).toEqual({action:'advice-forge',id:'weapon'});
 expect(combatAdviceDestination('survival')).toEqual({action:'bag-progression',id:'talents-defense'});
 expect(combatAdviceDestination('unknown')).toBeUndefined();
});
it('long authored HUD goals stay available in the tooltip and task page',()=>{
 const goal='回港整理应答名录，确认契约与召唤石的记录用途。';
 expect(hudGoalLabel(goal).length).toBeLessThanOrEqual(14);expect(hudGoalLabel('前往风栖岛')).toBe('前往风栖岛');
 const html=questTrackerHtml({current:[{id:'q',title:'解读旧航约',typeName:'支线',goal,note:'',current:0,total:1,state:'active'}]} as TaskView);
 expect(html).toContain('title="'+goal+'"');expect(html).toContain('查看任务目标 →');expect(html).toContain('data-action="hud-task-open"');
});
