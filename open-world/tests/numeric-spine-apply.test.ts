import {it,expect} from 'vitest';
import {z} from 'zod';
import {prepareSpinePlan,type SpineChange} from '../tools/spine/apply.ts';
const file='packages/content/aspects.json',source={[file]:[{id:'a',coefficient:1}]},schema={[file]:z.array(z.object({id:z.string(),coefficient:z.number().positive()}))};
const change:SpineChange={file,path:[0,'coefficient'],before:1,after:1.1,basis:'测试夹具：已知实测值及带边缘'};
it('完整预检后返回差量，不修改输入对象',()=>{
 expect(prepareSpinePlan(source,[change],schema)[file]).toEqual([{id:'a',coefficient:1.1}]);
 expect(source[file][0].coefficient).toBe(1);
});
it('拒绝越界文件、未知路径、缺少schema和过期before',()=>{
 expect(()=>prepareSpinePlan(source,[{...change,file:'../aspects.json'}],schema)).toThrow('白名单');
 expect(()=>prepareSpinePlan(source,[change],{})).toThrow('schema');
 expect(()=>prepareSpinePlan(source,[{...change,path:['unknown']}],schema)).toThrow('未知路径');
 expect(()=>prepareSpinePlan(source,[{...change,before:2}],schema)).toThrow('写前值');
});
it('schema失败时禁止产出计划；不能删换身份',()=>{
 expect(()=>prepareSpinePlan(source,[{...change,after:-1}],schema)).toThrow();
 expect(()=>prepareSpinePlan(source,[{...change,path:[0,'id'],before:'a',after:'b'}],schema)).toThrow('内容身份');
});
it('拒绝危险键、重复写入、非有限数与缺失依据',()=>{
 expect(()=>prepareSpinePlan(source,[{...change,path:['__proto__','polluted']}],schema)).toThrow('路径无效');
 expect(()=>prepareSpinePlan(source,[change,change],schema)).toThrow('重复');
 expect(()=>prepareSpinePlan(source,[{...change,after:NaN}],schema)).toThrow('有限');
 expect(()=>prepareSpinePlan(source,[{...change,basis:''}],schema)).toThrow('依据');
});
it('嵌套怪物模板身份也不能被schema合法的数值计划删掉',()=>{
 const path='packages/content/monsters.json',value={templates:[{id:'a'},{id:'b'}]};
 expect(()=>prepareSpinePlan({[path]:value},[{file:path,path:['templates'],before:value.templates,after:[{id:'a'}],basis:'测试身份保护'}],{[path]:z.object({templates:z.array(z.object({id:z.string()}))})})).toThrow('内容身份');
});
