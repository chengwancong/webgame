import {it,expect} from 'vitest';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
// 资源统一叫「能量」（progression-goal-plan §11.2，G8）：玩家能看到的文字和配置编辑器里不再出现修仙/奇幻旧称。
// 字段 id（mana）不变；旧报告、生成的构建产物、测试本身不查。
const root=resolve(import.meta.dirname,'..'),banned=/灵力|法力/;
const roots=['packages','apps/web/src','apps/api/src','config/json'],skip=/node_modules|[\\/]dist[\\/]|\.test\.ts$/;
function walk(dir:string,out:string[]){for(const name of readdirSync(dir)){const p=join(dir,name);if(skip.test(p))continue;if(statSync(p).isDirectory())walk(p,out);else if(/\.(ts|json|html|css)$/.test(name))out.push(p);}return out;}
it('player-facing text and editors say 能量, never 灵力 or 法力',()=>{
 const files=[...roots.flatMap(d=>walk(join(root,d),[])),...readdirSync(join(root,'apps/web')).filter(n=>n.endsWith('.html')).map(n=>join(root,'apps/web',n))];
 const hits=files.flatMap(f=>readFileSync(f,'utf8').split('\n').map((line,i)=>banned.test(line)?`${relative(root,f)}:${i+1}`:'').filter(Boolean));
 expect(files.length).toBeGreaterThan(100);expect(hits).toEqual([]);
});
