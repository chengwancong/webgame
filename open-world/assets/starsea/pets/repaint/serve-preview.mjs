import {join} from 'node:path';import {boot,group,json} from './pipeline.mjs';
const ctx=await boot(),url=ctx.base+'/art/starsea/pets/repaint/preview/index.html';await ctx.page.goto(url);await ctx.page.waitForFunction(()=>window.pa2?.ready);await json(join(group,'evidence/preview-session.json'),{url,pid:process.pid,headless:false});console.log('PA2_PREVIEW',url);
let closing=false;async function close(){if(closing)return;closing=true;await ctx.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);await new Promise(()=>{});
