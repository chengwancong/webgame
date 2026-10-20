import {it,expect} from 'vitest';
import {validateResponse,versions} from '../packages/contracts/index.ts';
import {parseFieldFreeze} from '../packages/contracts/field-freeze.ts';
const content=(waypoints:boolean)=>({versions,fieldFreeze:parseFieldFreeze({waypoints}),settings:{tickRate:30},regions:[{id:'map',custom:{value:1}}],skillCatalog:[{id:'skill'}],equipmentItems:[{id:'gear'}],hexRunes:[{id:'hex'}],crafting:{recipes:[]}});
it.each([false,true])('accepts actual content envelope without an ok field and preserves waypoints=%s',value=>{
 const input=content(value),before=structuredClone(input);
 expect(validateResponse('content',input)).toEqual(input);
 expect(validateResponse('content?cache=1',input)).toEqual(input);
 expect(input).toEqual(before);
});
it.each([
 {versions:undefined},{versions:{...versions,protocol:0}},{fieldFreeze:undefined},
 {fieldFreeze:{waypoints:'true'}},{fieldFreeze:{invented:true}},
])('rejects invalid consumed content fields rather than bypassing protocol checks: %j',patch=>{
 expect(()=>validateResponse('content',{...content(true),...patch})).toThrow();
});
it('does not loosen unknown endpoint or health response validation',()=>{
 expect(()=>validateResponse('unknown',content(true))).toThrow();
 expect(validateResponse('unknown',{ok:true})).toEqual({ok:true});
 expect(validateResponse('health',{ok:true,versions})).toMatchObject({ok:true,versions,auth_mode:'password'});
 expect(()=>validateResponse('health',{ok:false,versions})).toThrow();
});
