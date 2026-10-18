import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..');
const baseline=join(root,'docs/reviews/open-world-m2-m4/W0/content-id-whitelist.json');
async function files(dir,recursive=true){const out=[];for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory()&&recursive&&!['dist','public','node_modules','.vite','build'].includes(item.name))out.push(...await files(path));else if(item.isFile()&&/\.[cm]?[jt]sx?$/.test(item.name))out.push(path);}return out;}
/** Count occurrences as well as values so duplicating an old branch is not
 * hidden by the baseline. File + literal are stable across line insertions. */
export async function scanContentIds(){
 const inputs=[...await files(join(root,'apps')),...await files(join(root,'packages/rules')),...await files(join(root,'packages/simulation')),...await files(join(root,'packages/content'),false)],hits=[];
 for(const path of inputs){const source=await readFile(path,'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true),file=relative(root,path).replaceAll('\\','/');
  function visit(node){if(ts.isStringLiteralLike(node)&&/^(?:ss-(?:map|dg|c\d|mon|elite|boss|npc)|ow-(?:art|road|water|pose|event|chest|rare|island)|m0-|(?:wind|mist|forge|frost|rift|dragon)-[a-z]\d)/.test(node.text)){const line=ast.getLineAndCharacterOfPosition(node.getStart()).line+1;hits.push({file,value:node.text,line});}ts.forEachChild(node,visit);}visit(ast);
 }return hits.sort((a,b)=>a.file.localeCompare(b.file)||a.line-b.line);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const hits=await scanContentIds();if(process.argv.includes('--baseline')){await mkdir(dirname(baseline),{recursive:true});await writeFile(baseline,JSON.stringify({scope:'apps/**, packages/rules/**, packages/simulation/**, packages/content/*.ts',scanner:'typescript string literals, occurrence counts, content ID prefixes',hits},null,2)+'\n');console.log(JSON.stringify({baseline:true,hits:hits.length}));}
 else {const old=JSON.parse(await readFile(baseline,'utf8')).hits,remaining=new Map();for(const h of old){const key=h.file+'\0'+h.value;remaining.set(key,(remaining.get(key)??0)+1);}const added=hits.filter(h=>{const key=h.file+'\0'+h.value,n=remaining.get(key)??0;if(n){remaining.set(key,n-1);return false;}return true;});console.log(JSON.stringify({passed:!added.length,hits:hits.length,added}));if(added.length)process.exitCode=1;}
}
