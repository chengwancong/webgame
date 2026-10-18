import {join} from 'node:path';import {writeFile} from 'node:fs/promises';import {boot,load,render,group,sharp} from './pipeline.mjs';
const style=+(process.argv[2]??1),ctx=await boot(),tiles=[];
try{for(const [col,stage] of ['a','c','d'].entries()){
 await load(ctx,'D1',stage,{prefix:`/group/sources/style${style}/guaiD1${stage}/`});
 const b=(await render(ctx,'idle',0)).bounds,cam={cell:256,span:Math.max(b.maxX-b.minX,b.maxY-b.minY)*1.6,cx:(b.minX+b.maxX)/2,cy:(b.minY+b.maxY)/2};
 for(const [row,[action,time]] of [['idle',0],['idle',.2],['attack',.5],['knock',.1]].entries()){const f=await render(ctx,action,time,cam),buf=Buffer.from(f.png.split(',')[1],'base64');tiles.push({input:buf,left:col*256,top:row*256});}
}await sharp({create:{width:768,height:1024,channels:4,background:'#e6deca'}}).composite(tiles).png().toFile(join(group,'evidence',`style${style}-draft-check.png`));}finally{await ctx.close();}
