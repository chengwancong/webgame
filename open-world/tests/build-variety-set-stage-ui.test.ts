import {it,expect} from 'vitest';
import {gearSetChanges} from '../apps/web/src/components/gear-metadata.ts';
import type {EquippedSetInfo} from '../packages/contracts/index.ts';
const info=(artStage:number):EquippedSetInfo=>({setId:'set-sword-standard',setName:'割裂',count:4,total:6,activeBonuses:[2,4],artStage});
it('shows a minimum-stage change even when the same bonuses and number of pieces remain active',()=>{const html=gearSetChanges([info(1)],[info(3)]);expect(html).toContain('<p class="positive">换上后，现有套装加成会改变</p>');expect(html).not.toContain('激活 4 件');expect(html).not.toContain('失去 4 件');});
it('shows the reverse stage change with a negative tone and keeps unchanged previews empty',()=>{const html=gearSetChanges([info(3)],[info(1)]);expect(html).toContain('<p class="negative">换上后，现有套装加成会改变</p>');expect(gearSetChanges([info(3)],[info(3)])).toBe('');});
it('uses resolved server text for stage previews, activation and loss rather than recalculating or reusing T1 text',()=>{
 const current={...info(1),bonusDescriptions:{'2':'暴击率+8%','4':'T1实际参数'}},next={...info(3),bonusDescriptions:{'2':'暴击率+12%','4':'T3实际参数'}},stage=gearSetChanges([current],[next]);expect(stage).toContain('2 件套加成：暴击率+12%');expect(stage).not.toContain('暴击率+8%');expect(stage).toContain('T3实际参数');
 expect(gearSetChanges([{...current,count:1,activeBonuses:[]}],[next])).toContain('激活 4 件套加成：T3实际参数');expect(gearSetChanges([next],[{...current,count:1,activeBonuses:[]}])).toContain('失去 4 件套加成：T3实际参数');
});
