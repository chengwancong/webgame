import {it,expect} from 'vitest';
import {augmentById,augments} from '../packages/content/augments.ts';
import {newAspectById,newAspects} from '../packages/content/aspects.ts';
it('主干改动的复生与领域说明保留执行数值、次数和中文名称',()=>{
 const phoenix=augmentById.get('aug-p-phoenix')!;
 expect(phoenix.description).toContain('恢复85%最大生命');
 expect(phoenix.description).toContain('本局最多触发1次');
 expect(phoenix.parts.rules[0].description).toContain('恢复85%最大生命');
 expect(newAspectById.get('aspect-tf-meteor')!.description).toContain('火焰伤害');
});
it('已生成内容不向玩家泄漏缺失字段和内部属性名',()=>{
 for(const item of [...augments,...newAspects])expect(item.description,item.id).not.toMatch(/undefined|reviveRatio|\bfire\b/);
});
