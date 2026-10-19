import {expect,it} from 'vitest';
import {assertReleaseVersions,committedVersions} from '../tools/deploy-versions.ts';
const expected=committedVersions("export const versions={client:'0.11.29',protocol:38,rules:'ow-74',assets:'art-v24',db:17} as const;");
it('rejects an incompatible server before activating client files even when client version matches',()=>{
 for(const key of ['protocol','rules','assets','db'] as const)expect(()=>assertReleaseVersions({...expected,[key]:'other'},expected)).toThrow(key+' mismatch');
 expect(()=>assertReleaseVersions(undefined,expected)).toThrow('missing');
 expect(()=>assertReleaseVersions(expected,expected)).not.toThrow();
});
