import {readFile,writeFile,copyFile,mkdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),file=join(root,'packages/content/equipment-catalog.json');
const directory=join(root,'../docs/reviews/open-world/equipment-runtime-20261004');
await mkdir(directory,{recursive:true});
const previous=join(directory,'catalog-before-runtime.json');
try{await access(previous);}catch(error){if(error.code!=='ENOENT')throw error;await copyFile(file,previous);}
const catalog=JSON.parse(await readFile(file,'utf8'));if(catalog.items.length!==324)throw Error('Expected the complete 324-item catalog');
for(const item of catalog.items){item.obtainable=true;item.runtimeBase=item.id;}
await writeFile(file,JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({obtainable:324,runtimeDefinitions:324}));
