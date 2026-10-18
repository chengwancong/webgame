import {mkdir,writeFile} from 'node:fs/promises';
import {benchPlayer} from './bench.ts';
import {standardState,resolvePlayer,referencePlayer} from './player.ts';
const out='docs/reviews/numeric-spine-20261013/S1';await mkdir(out,{recursive:true});
const standard=resolvePlayer('标准人50',standardState(50));
const results=[standard,referencePlayer('opening').player].map(player=>benchPlayer(player,standard.build.stats.hp,[41]));
await writeFile(out+'/pilot.json',JSON.stringify({scope:'S1单种子工程检查，不是S2额度测量',results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({id:r.player,metrics:r.metrics,censored:r.censored,rows:r.rows.map(x=>({axis:x.axis,seconds:x.seconds,loss:x.netHpLoss,maxCastShare:x.maxCastShare,failed:x.failed}))})),null,2));
