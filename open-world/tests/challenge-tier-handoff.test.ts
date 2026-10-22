import {describe,expect,it} from 'vitest';
import {challengeTierPick} from '../apps/web/src/dungeon-controller.ts';
describe('challenge tier handoff',()=>{
 it('passes a valid typed tier through',()=>{expect(challengeTierPick({'nightmare-a':'100'},'nightmare-a')).toBe(100);});
 it('ignores missing, empty and invalid values',()=>{
  for(const v of [undefined,'','0','-3','2.5','abc'])expect(challengeTierPick({x:v},'x')).toBeUndefined();
  expect(challengeTierPick({},'x')).toBeUndefined();
 });
});
