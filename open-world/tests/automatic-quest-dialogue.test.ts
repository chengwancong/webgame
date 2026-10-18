import {expect,it} from 'vitest';
import {automaticQuestDialogues} from '../apps/web/src/automatic-quest-dialogue.ts';
it('plays automatic acceptance dialogue for untracked quests, then deduplicates it and waits for the destination map',()=>{
 const quests=['tracked','untracked','next-map'].map(id=>({id,title:id,accept:[{speaker:'NPC',text:id}],step:{map:id==='next-map'?'other':'here'}})),modes=new Map([['tracked','none'],['untracked','arrive'],['next-map','none']]),seen=new Set<string>();
 const first=automaticQuestDialogues(quests,'here',id=>modes.get(id),seen);expect(first.map(q=>q.id)).toEqual(['tracked','untracked']);first.forEach(q=>seen.add('accept:'+q.id));expect(automaticQuestDialogues(quests,'here',id=>modes.get(id),seen)).toEqual([]);expect(automaticQuestDialogues(quests,'other',id=>modes.get(id),seen).map(q=>q.id)).toEqual(['next-map']);
});
