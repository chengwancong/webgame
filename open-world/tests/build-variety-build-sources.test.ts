import {it,expect} from 'vitest';
import {buildSourcePartsSchema} from '../packages/contracts/build-sources.ts';
it('accepts a sparse known-stat override or multiplier without requiring every registered stat',()=>{
 const out=buildSourcePartsSchema.parse({statMultipliers:{hp:.5},statOverrides:{critChance:0}});expect(out.statMultipliers).toEqual({hp:.5});expect(out.statOverrides).toEqual({critChance:0});
 expect(buildSourcePartsSchema.parse({statMultipliers:{}}).statMultipliers).toEqual({});
});
it('still rejects unknown stat IDs, negative multipliers and non-finite override values',()=>{
 expect(buildSourcePartsSchema.safeParse({statMultipliers:{inventedPower:2}}).success).toBe(false);
 expect(buildSourcePartsSchema.safeParse({statMultipliers:{hp:-1}}).success).toBe(false);
 expect(buildSourcePartsSchema.safeParse({statOverrides:{critChance:NaN}}).success).toBe(false);
});
