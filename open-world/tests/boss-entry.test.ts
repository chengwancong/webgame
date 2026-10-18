import {it,expect} from 'vitest';
import {resolveBossAccess} from '../packages/rules/boss-access.ts';
import type {Progress} from '../packages/contracts/index.ts';
const progress:Progress={kills:999,regions:['town','meadow','forest'],bosses:[],safe:'town',tasks:[]};
it('does not turn global kills into current-area clearance',()=>{
 const access=resolveBossAccess(progress);expect(access['meadow-boss'].eligible).toBe(false);expect(access['forest-boss'].kills).toBe(0);
});
it('requires a regional elite as well as regional kills',()=>{
 const p={...progress,regionKills:{meadow:6},regionElites:{meadow:0}};
 expect(resolveBossAccess(p)['meadow-boss'].eligible).toBe(false);
 expect(resolveBossAccess({...p,regionElites:{meadow:1}})['meadow-boss'].eligible).toBe(true);
 expect(resolveBossAccess({...p,regionElites:{meadow:1}})['forest-boss'].eligible).toBe(false);
});
it('preserves retries of a cleared boss and still requires its area to be open',()=>{
 expect(resolveBossAccess({...progress,bosses:['meadow-boss']})['meadow-boss'].eligible).toBe(true);
 expect(resolveBossAccess({...progress,regions:['town'],bosses:['meadow-boss']})['meadow-boss'].eligible).toBe(false);
});
