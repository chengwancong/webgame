import {it,expect} from 'vitest';
import {z} from 'zod';
import {prepareSpinePlan,type SpineChange} from '../tools/spine/apply.ts';
it('only appends dungeon definitions at the tail and preserves every existing identity and field',()=>{
 const file='packages/content/dungeons.json',old={definitions:[{id:'old',name:'keep'}]},schema={[file]:z.object({definitions:z.array(z.object({id:z.string(),name:z.string()}))})};
 const change:SpineChange={file,path:['definitions',1],before:null,after:{id:'new',name:'new'},op:'append',basis:'P27 fixture'};
 const next=prepareSpinePlan({[file]:old},[change],schema) as any;expect(next[file].definitions).toEqual([...old.definitions,{id:'new',name:'new'}]);expect(old.definitions).toHaveLength(1);
 expect(()=>prepareSpinePlan({[file]:old},[{...change,path:['definitions',0]}],schema)).toThrow();expect(()=>prepareSpinePlan({[file]:old},[{...change,path:['unknown',1]}],schema)).toThrow();
 expect(()=>prepareSpinePlan({[file]:old},[change,{file,path:['definitions',0,'name'],before:'keep',after:'changed',basis:'forbidden mixture'}],schema)).toThrow('追加内容不可同时修改');
});
