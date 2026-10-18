import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root,startPreviewServer} from './preview-server.mjs';
const out=join(root,'assets/starsea/bosses/evidence');await mkdir(out,{recursive:true});
const server=await startPreviewServer(),browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const mode=process.argv[2]??'body';const page=await browser.newPage({viewport:{width:1240,height:1560}});await page.goto(server.origin+'/art/starsea/bosses/inventory.html?mode='+mode);await page.waitForFunction(()=>window.inventory?.ready||window.inventory?.errors.length,{timeout:45000});
 const diagnostics=await page.evaluate(()=>window.inventory);if(diagnostics.errors.length)throw Error(diagnostics.errors.join('; '));await page.screenshot({path:join(out,'native-'+mode+'-candidates.png'),fullPage:true});await writeFile(join(out,'native-'+mode+'-inventory.json'),JSON.stringify(diagnostics,null,2)+'\n');console.log('native-'+mode+'-candidates.png: '+diagnostics.items.length+' native skins');
}finally{await browser.close();await server.close();}
