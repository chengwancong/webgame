// Single entry into the existing spine pipeline, no independent formulas or writer.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),mode=args.some(a=>['--derive','--measure-combat','--verify','--apply','--correction','--requirements'].includes(a))?[]:['--derive'];
const result=spawnSync(process.execPath,['--import','tsx','tools/spine/cli.ts','hub-rewards',...mode,...args],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;

