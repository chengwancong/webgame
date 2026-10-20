import {expect,it} from 'vitest';
import {dialogueLines,taskById,stepsByTask} from '../packages/content/task-tables.ts';

it('shows the rescued workers only when the signal was learned, without replacing the return-to-port line',()=>{
 const plain=dialogueLines('ss-c01-t05:complete',{conditions:[]});
 const signal=dialogueLines('ss-c01-t05:complete',{conditions:['ow-wind-knows-signal']});
 expect(plain).toHaveLength(4);expect(signal).toHaveLength(5);
 expect(signal.filter(l=>!l.text.includes('被扣下的码头工'))).toEqual(plain);
 expect(signal[3].speaker).toBe('ss-npc-milo');
 expect(signal[3].text).toContain('被扣下的码头工');expect(signal[4]).toEqual(plain[3]);
});
it('keeps boss-only quests free of invented gate objectives in their updated preparation lines',()=>{
 expect(stepsByTask.get('ss-c01-t05')?.map(s=>s.op)).toEqual(['boss']);
 expect(stepsByTask.get('ss-c05-t05')?.map(s=>s.op)).toEqual(['boss']);
 expect(dialogueLines('ss-c01-t05:accept',{}).some(l=>l.text.includes('平台在船坞要塞后头'))).toBe(true);
});
it('does not advertise absent hand-in or second-device steps in quest goals',()=>{
 expect(taskById.get('ow-frost-side-z6-2')?.goal).toBe('抄下星盘室门口的校验记录，雪弥要拿它核对航钥。');
 expect(taskById.get('ow-rift-side-z4-1')?.goal).toBe('清掉裂隙里的营地，找到迷路的妈妈。');
 expect(taskById.get('ss-c03-t02')?.goal).toBe('清掉两座冷却阀旁的搬运机，把阀重新打开。');
 expect(stepsByTask.get('ss-c04-n02')?.find(s=>s.seq===2)?.label).toBe('听烬羽说明来历');
});
