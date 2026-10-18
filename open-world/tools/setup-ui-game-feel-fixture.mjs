// A dedicated QA account avoids taking control of another acceptance session.
// Only the new ui_feel_* character is seeded; the source character remains read-only.
import {chromium} from 'playwright';
import {Pool} from 'pg';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='.qa/ui-game-feel';await mkdir(dir,{recursive:true});
const username='ui_feel_'+Date.now().toString(36),source=JSON.parse(await readFile('.qa/progression-ui/character.json','utf8'));
const port=(await readFile('.runtime/dev/data/postmaster.pid','utf8')).split(/\r?\n/)[3];
const pool=new Pool({connectionString:`postgresql://aw_world@127.0.0.1:${port}/postgres`});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();page.setDefaultTimeout(30000);
try {
 await page.goto('http://127.0.0.1:8612/');await page.locator('#username:not(:disabled)').fill(username);await page.locator('[data-action=login]').click();await page.locator('[data-action=create]').waitFor();await page.locator('[data-action=create]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().panel==='');await page.waitForTimeout(1000);
 await mkdir('docs/reviews/ui-game-feel-20261005/login',{recursive:true});await page.screenshot({path:'docs/reviews/ui-game-feel-20261005/login/new-character-camp.png'});
 const current=await page.evaluate(()=>window.awInspect().snapshot);
 const row=(await pool.query('SELECT c.state,a.username FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE c.id=$1',[source.id])).rows[0];assert.equal(row.username,source.username);assert(row.username.startsWith('growth_ui_'));
 const state=structuredClone(row.state);state.id=current.id;state.name='层级验收';state.revision=current.revision+1;state.build=current.build+1;delete state.dungeon;
 const own=(await pool.query('SELECT a.username FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE c.id=$1',[current.id])).rows[0];assert.equal(own.username,username);assert(username.startsWith('ui_feel_'));
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,current.id]);
 await page.reload();await page.waitForFunction(()=>window.awInspect?.().loggedIn||window.awInspect?.().panel==='takeover');if(await page.locator('[data-action=takeover]').count())await page.locator('[data-action=takeover]').click();await page.waitForFunction(()=>window.awInspect?.().loggedIn&&window.awInspect().snapshot.name==='层级验收');
 await context.storageState({path:dir+'/session.json'});await writeFile(dir+'/character.json',JSON.stringify({id:current.id,username,source:'read-only clone of the existing established-character QA fixture',newCharacterRegion:current.starseaView?.map??current.lastRegion}));
 console.log(JSON.stringify({username,id:current.id,seededOnlyDedicatedQAAccount:true}));
}finally{await context.close();await browser.close();await pool.end();}
