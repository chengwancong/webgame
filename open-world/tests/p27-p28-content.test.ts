import {it,expect} from 'vitest';
import source from '../packages/content/progression-challenges.json';
import {challengeContentSchema} from '../packages/content/progression-challenges.ts';
import {prepareSpinePlan,type SpineChange} from '../tools/spine/apply.ts';
it('scheduled season additions preserve the legacy object and cannot overwrite or escape the explicit field',()=>{
 const file='packages/content/progression-challenges.json',old=structuredClone(source) as any;delete old.seasons;
 const change:SpineChange={file,path:['seasons'],before:null,after:source.seasons,op:'add',basis:'P28 schedule fixture'},schema={[file]:challengeContentSchema};
 const next=prepareSpinePlan({[file]:old},[change],schema) as any;expect(next[file].season).toEqual(old.season);expect(old).not.toHaveProperty('seasons');
 expect(()=>prepareSpinePlan({[file]:source},[change],schema)).toThrow('未存在');
 expect(()=>prepareSpinePlan({[file]:old},[{...change,path:['entries']}],schema)).toThrow();
 expect(()=>prepareSpinePlan({[file]:old},[change],{})).toThrow();
});
it('rejects overlapping dates, duplicate season IDs and duplicate reward IDs before a spine write',()=>{
 for(const edit of [(s:any)=>s.seasons[0].start=s.season.start,(s:any)=>s.seasons[0].id=s.season.id,(s:any)=>s.seasons[0].rewards[1].id=s.seasons[0].rewards[0].id]){
  const s=structuredClone(source);edit(s);expect(()=>challengeContentSchema.parse(s)).toThrow('Invalid season schedule');
 }
});
