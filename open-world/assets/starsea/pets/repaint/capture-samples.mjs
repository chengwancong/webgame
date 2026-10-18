import {join} from 'node:path';import {boot,group,json} from './pipeline.mjs';
const ctx=await boot(),checks=[];
try{await ctx.page.setViewportSize({width:2400,height:1100});for(const style of [1,2,3]){await ctx.page.goto(ctx.base+`/group/sample.html?style=${style}`);await ctx.page.waitForFunction(()=>window.pa2?.ready||window.pa2Error);if(await ctx.page.evaluate(()=>window.pa2Error))throw Error(await ctx.page.evaluate(()=>window.pa2Error));await ctx.page.locator('#sheet').screenshot({path:join(group,'evidence',`sample-${style}.png`)});checks.push(await ctx.page.evaluate(()=>window.pa2.state()));}
 await ctx.page.goto(ctx.base+'/group/sample.html?mode=compare');await ctx.page.waitForFunction(()=>window.pa2?.ready);await ctx.page.locator('#sheet').screenshot({path:join(group,'evidence/compare.png')});await json(join(group,'evidence/sample-capture.json'),{headless:false,checks,source:'actual native-rendered atlas frames and existing native player rig'});
}finally{await ctx.close();}
