import {it,expect} from 'vitest';
import {newAspectById,newAspects} from '../packages/content/aspects.ts';
import {existsSync} from 'node:fs';
it('主干保留局外威能的中文说明，局内潮印目录与说明器已撤销',()=>{
 expect(existsSync('packages/content/augments.json')).toBe(false);
 expect(existsSync('packages/rules/augment-descriptions.ts')).toBe(false);
 expect(newAspectById.get('aspect-tf-meteor')!.description).toContain('火焰伤害');
});
it('已生成内容不向玩家泄漏缺失字段和内部属性名',()=>{
 for(const item of newAspects)expect(item.description,item.id).not.toMatch(/undefined|reviveRatio|\bfire\b/);
});
