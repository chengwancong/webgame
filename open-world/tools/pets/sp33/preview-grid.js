function grid(list,{cols=3,cellW=340,cellH=300,startY=36,zoom=1,t=time,still=false}={}){
 const spacious=cellH>=260,rootOffset=spacious?cellH-100:cellH-52;
 for(let row=0;row<Math.ceil(list.length/cols);row++){const yy=startY+row*cellH;ctx.fillStyle=ctx.createPattern(grass,'repeat');ctx.fillRect(0,yy,cols*cellW,cellH-(spacious?50:36));ctx.fillStyle=ctx.createPattern(road,'repeat');ctx.fillRect(0,yy+rootOffset-20,cols*cellW,spacious?70:24);}
 list.forEach((s,i)=>{const x=(i%cols+.5)*cellW,y=startY+Math.floor(i/cols)*cellH+rootOffset;records.push(engine.compose(ctx,s,form,action,t,x,y,{mirror,zoom,stillFX:still,showSockets:$('sockets').checked}));txt(`${s.islandName} ${s.tierName} ${engine.catalog.get(s.forms[form].base).displayHeight}px · ${s.family}`,x,y+(spacious?70:29),12);txt(`${s.professionName} · ${s.flowName}`,x,y+(spacious?88:46),13);});
}
