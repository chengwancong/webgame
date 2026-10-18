import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {boot,load,render,pixels,sharp,group,families,json,record} from './pipeline.mjs';
const ctx=await boot(),cells=[],records=[];
try{for(let row=0;row<families.length;row++)for(let col=0;col<5;col++){
 const family=families[row],stage='abcde'[col],info=await load(ctx,family,stage),sample=await render(ctx,'idle',0),b=sample.bounds;
 const camera={cell:512,span:Math.max(b.maxX-b.minX,b.maxY-b.minY)*1.15,cx:(b.minX+b.maxX)/2,cy:(b.minY+b.maxY)/2};
 const frame=await render(ctx,'idle',0,camera),buf=Buffer.from(frame.png.split(',')[1],'base64'),box=await pixels(buf);
 if(box.count===0||box.x<2||box.y<2)throw Error('Invalid candidate '+info.name);
 const path=join(group,'evidence',info.name+'-idle0.png');await writeFile(path,buf);
 const crop=await sharp(buf).extract({left:box.x,top:box.y,width:box.w,height:box.h}).resize({width:145,height:140,fit:'inside'}).png().toBuffer();const meta=await sharp(crop).metadata();
 cells.push({input:crop,left:90+col*180+Math.round((180-meta.width)/2),top:60+row*175+Math.round((145-meta.height)/2)});
 records.push({family,stage,name:info.name,version:info.version,gpu:info.gpu,actions:info.actions,bones:info.bones,slots:info.slots,pixelBounds:box,camera,source:await record(join(info.dir,info.name+'.json'))});
 console.log(info.name,box.w,box.h);
}
 const height=60+families.length*175,width=990;
 const labels='<svg width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="#f3efe5"/>'+['a','b','c','d','e'].map((s,i)=>`<text x="${175+i*180}" y="35" text-anchor="middle" font-family="Arial" font-size="22">${s}</text>`).join('')+families.map((f,i)=>`<text x="15" y="${145+i*175}" font-family="Arial" font-size="22">${f}</text><path d="M0 ${60+(i+1)*175}H990" stroke="#d6d0c2"/>`).join('')+'</svg>';
 await sharp(Buffer.from(labels)).composite(cells).png().toFile(join(group,'evidence/candidate-contact-sheet.png'));
 await json(join(group,'evidence/candidates.json'),records);
 console.log('COMPLETE 85 candidates');
}finally{await ctx.close();}
