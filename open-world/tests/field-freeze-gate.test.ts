import {describe,expect,it} from 'vitest';
import {boardEntryVisible,eventPointVisible} from '../apps/web/src/field-freeze-gate.ts';
import {parseFieldFreeze} from '../packages/contracts/field-freeze.ts';

describe('field freeze client gate',()=>{
 it('defaults change nothing',()=>{const f=parseFieldFreeze();expect(boardEntryVisible(f)).toBe(true);expect(boardEntryVisible(undefined)).toBe(true);for(const s of [undefined,'ready','cooldown','running'])expect(eventPointVisible(f,s)).toBe(true);});
 it('bounties=true hides the board entry',()=>{expect(boardEntryVisible(parseFieldFreeze({bounties:true}))).toBe(false);});
 it('events=true hides idle points but keeps running/claimable ones',()=>{const f=parseFieldFreeze({events:true});expect(eventPointVisible(f,undefined)).toBe(false);expect(eventPointVisible(f,'ready')).toBe(false);expect(eventPointVisible(f,'cooldown')).toBe(false);expect(eventPointVisible(f,'running')).toBe(true);expect(eventPointVisible(f,'success')).toBe(true);});
});
