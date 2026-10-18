import {mkdir,writeFile} from 'node:fs/promises';
import {pacingProfiles,pacingBuild,profileSubstitutions} from './profiles.ts';
import {versions} from '../../packages/contracts/index.ts';
const rows=pacingProfiles.map(p=>{const assembled=pacingBuild(p);return {id:p.id,name:p.name,profile:p,skills:assembled.build.skills.map(s=>s.id),stats:assembled.build.stats,sets:assembled.sets,acquisition:assembled.acquisition};});
await mkdir('docs/reviews/pacing-tool-20261010',{recursive:true});
await writeFile('docs/reviews/pacing-tool-20261010/build-preflight.json',JSON.stringify({versions,profileSubstitutions,rows},null,2));
console.log(JSON.stringify(rows.map(r=>({id:r.id,skills:r.skills,attack:r.stats.attack,hp:r.stats.hp,armor:r.stats.armor}))));
