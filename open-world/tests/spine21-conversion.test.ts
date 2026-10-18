import {it,expect} from 'vitest';
import {upgradeSpine21,physicalSlotAllowed,attachmentSequence} from '../tools/spine-hit-export/spine21-convert.js';
it('retains packed bone weights and exact deform/keyframe times when upgrading a 2.1 mesh',()=>{
 const source={skeleton:{spine:'2.1.27'},bones:[{name:'root',inheritRotation:false,inheritScale:false}],slots:[{name:'blade',additive:true}],skins:{default:{blade:{blade:{type:'skinnedmesh',vertices:[1,0,1.5,2.5,1],uvs:[0,1],triangles:[0,1,2]}}}},animations:{hit:{ffd:{default:{blade:{blade:[{time:.133333,vertices:[1,2]}]}}}}}};
 const result=upgradeSpine21(source);expect(result.raw.skins.default.blade.blade.type).toBe('mesh');expect(result.raw.skins.default.blade.blade.vertices).toEqual(source.skins.default.blade.blade.vertices);expect(result.raw.animations.hit.deform).toEqual(source.animations.hit.ffd);expect(result.raw.bones[0].transform).toBe('onlyTranslation');expect(result.raw.slots[0].blend).toBe('additive');expect(source.skeleton.spine).toBe('2.1.27');
});
it('excludes the literal text slots and leaf ring, and follows original attachment timestamps in D2 mode',()=>{
 expect(physicalSlotAllowed('blade-streak','zi1')).toBe(false);expect(physicalSlotAllowed('blade-streak','iu')).toBe(true);expect(physicalSlotAllowed('ground-crater','tengman')).toBe(false);expect(physicalSlotAllowed('ground-ring','hitguangquan_a1')).toBe(false);expect(physicalSlotAllowed('ground-rock','suishi_s1')).toBe(true);
 const sequence=attachmentSequence({slots:[{name:'iu',attachment:'a'}],skins:{default:{iu:{a:{path:'a'},b:{path:'b'}}}},animations:{hit:{slots:{iu:{attachment:[{time:0,name:'a'},{time:.1,name:'b'}]}}}}},'blade-streak');expect(sequence.regionAt(.099)).toBe('a');expect(sequence.regionAt(.1)).toBe('b');
});
