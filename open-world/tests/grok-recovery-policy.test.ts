import {expect,it} from 'vitest';
import {dungeonSocketURL,finalReportFailure,RenewalGate,resultActionAllowed} from '../apps/web/src/recovery-policy.ts';
it('keeps recovery and safe exit accessible over a restored result while rejecting unrelated writes',()=>{
 for(const action of ['recover','close','result-return','result-retry'])expect(resultActionAllowed(action)).toBe(true);
 expect(resultActionAllowed('gear-upgrade')).toBe(false);
});
it('does not replay definitively rejected reports or confuse uncertain network failures with rejection',()=>{
 for(const code of ['EXPIRED','SEQUENCE','BUILD','QUEST_WAVE_EXPIRED'])expect(finalReportFailure({code})).toBe(true);
 for(const code of ['NETWORK','SERVER','CONTROL','NOT_FOUND'])expect(finalReportFailure({code})).toBe(false);
});
it('uses a credential-free websocket URL for a basic-auth landing address',()=>expect(dungeonSocketURL('https://user:secret@example.test/','instance')).toBe('wss://example.test/api/dungeons/instance/live'));
it('serializes slow renewal and tolerates transient failure only inside the remaining lease budget',()=>{
 const gate=new RenewalGate();expect(gate.begin(1000)).toBe(true);expect(gate.begin(2000)).toBe(false);
 expect(gate.canRetry({code:'NETWORK'},21000)).toBe(true);expect(gate.canRetry({code:'CONTROL'},21000)).toBe(false);
 gate.success(25000);gate.finish();expect(gate.begin(30000)).toBe(true);expect(gate.canRetry({code:'NETWORK'},145000)).toBe(false);
});
