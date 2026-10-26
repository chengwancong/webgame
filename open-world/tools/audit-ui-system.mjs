import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),postcss=createRequire(require.resolve('vite'))('postcss');
const root=resolve('apps/web/src'),result={generatedAt:new Date().toISOString(),scope:'Styles reachable from the production ui-entry.css plus UI-rendering TypeScript. Generated token values, game art, simulation and dev-only showcases are excluded.',files:[],remainingColorLiterals:0,remainingFontSizes:0},seen=new Set();
const literals=value=>(value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)??[]).filter(v=>!v.includes('var('));
async function css(path){if(seen.has(path))return;seen.add(path);const source=await readFile(path,'utf8'),file=relative(root,path).replaceAll('\\','/'),sheet=postcss.parse(source,{from:file}),colors=[],fonts=[],imports=[];
 sheet.walkAtRules('import',rule=>{const match=rule.params.match(/(?:url\()?['"]([^'"]+)/);if(match)imports.push(resolve(dirname(path),match[1]));});
 if(file!=='ui/tokens.css'){sheet.walkDecls(d=>{for(const value of literals(d.value))colors.push({line:d.source.start.line,property:d.prop,value});if(d.prop==='font-size'&&!d.value.includes('var(')||d.prop==='font'&&/\b\d+(?:\.\d+)?(?:px|rem)\b/.test(d.value))fonts.push({line:d.source.start.line,value:d.value});});result.remainingColorLiterals+=colors.length;result.remainingFontSizes+=fonts.length;result.files.push({file,colorLiterals:colors.length,fontSizes:fonts.length,colors,fonts});}
 for(const dependency of imports)await css(dependency);
}
await css(resolve(root,'ui-entry.css'));
await css(resolve(root,'hub/hub-entry.css'));
await css(resolve(root,'tactical/tactical.css'));
const filenames=(await readdir(root)).filter(name=>/^(scene|presentation|task-panel|task-symbols|travel-browser|hud-icons|warning-ui|skills-panel|appearance-panel|progression-panel|progression-challenges)\.ts$/.test(name));
for(const sub of ['components','ui','hub','tactical'])for(const name of await readdir(resolve(root,sub)))if(name.endsWith('.ts')&&!['tokens.ts'].includes(name))filenames.push(sub+'/'+name);
for(const file of filenames){const source=await readFile(resolve(root,file),'utf8'),colors=[];source.split('\n').forEach((line,index)=>{// strip querySelector('#...') and dynamic template-literal color calls (runtime values, not tokenisable)
const stripped=line.replace(/(?:\$|querySelector(?:All)?(?:<[^>]+>)?)\(\s*['"]#[^'"]+['"]\s*\)/g,'').replace(/rgba?\([^)]*\$\{[^)]*\)/g,'');for(const value of literals(stripped))colors.push({line:index+1,value});});result.remainingColorLiterals+=colors.length;result.files.push({file,colorLiterals:colors.length,fontSizes:0,colors,fonts:[]});}
const folder=resolve('../.design/global-ui-system');await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'source-audit.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({files:result.files.length,remainingColorLiterals:result.remainingColorLiterals,remainingFontSizes:result.remainingFontSizes,scope:result.scope,remaining:result.files.filter(f=>f.colorLiterals||f.fontSizes).map(f=>({file:f.file,colors:f.colorLiterals,fonts:f.fontSizes}))}));
if(process.argv.includes('--strict')&&(result.remainingColorLiterals||result.remainingFontSizes))process.exitCode=1;
