import {loadImage,type Asset,type PropState} from './starsea-assets.ts';
const color=(name:string)=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export class StarseaPropPreview{
 private image?:HTMLImageElement;private state?:PropState;private asset?:Asset;private generation=0;private chartPlacement?:{dx:number;dy:number;scale:number};selection='';
 async load(asset:Asset,state:string){const generation=++this.generation;this.asset=asset;const s=asset.runtime.states?.[state]??{kind:'sprite',file:asset.runtime.file!,displayHeight:asset.runtime.displayHeight??160,anchor:asset.runtime.anchor??[.5,.9],visible:true,annotation:'场景独立资源参考'};this.state=s;const image=await loadImage(s.file);if(generation===this.generation)this.image=image;}
 render(ctx:CanvasRenderingContext2D,clock:number,facing:number){
  const image=this.image,s=this.state,a=this.asset;if(!image||!s||!a||s.visible===false)return;
  const vector=s.file.endsWith('.svg'),baseHeight=s.displayHeight??a.runtime.displayHeight??160,h=s.kind==='chart'?Math.min(baseHeight,ctx.canvas.height-32,(ctx.canvas.width-32)*image.height/image.width):baseHeight,dh=s.referenceScale?image.height*s.referenceScale:vector?h:h*image.height/Math.max(1,image.height-16),dw=dh*image.width/image.height;
  const anchor=s.anchor??[.5,.9],x=ctx.canvas.width/2,y=s.kind==='chart'?ctx.canvas.height/2:320;
  ctx.save();ctx.translate(x,y);if(s.kind!=='chart')ctx.scale(facing===1?-1:1,1);const dx=-anchor[0]*dw,dy=-anchor[1]*dh;if(s.material)ctx.filter=`saturate(${s.material.saturation}) brightness(${s.material.brightness})`;ctx.drawImage(image,dx,dy,dw,dh);ctx.filter='none';
  if(s.light){const p=s.light.center,r=s.light.radius*(.75+.25*Math.sin(clock*2*Math.PI/s.light.period));ctx.beginPath();ctx.arc(dx+p[0]*dw,dy+p[1]*dh,r,0,Math.PI*2);ctx.globalAlpha=.25;ctx.fillStyle=color(s.light.color==='danger'?'--color-danger':'--color-info');ctx.fill();ctx.globalAlpha=.75;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;}
  if(s.portal){const [px,py,pw,ph]=s.portal.bounds;ctx.save();ctx.beginPath();ctx.ellipse(dx+(px+pw/2)*dw,dy+(py+ph/2)*dh,pw*dw/2,ph*dh/2,0,0,Math.PI*2);ctx.clip();ctx.fillStyle=color('--color-info');ctx.globalAlpha=.2;ctx.fill();ctx.globalAlpha=.8;for(let n=0;n<14;n++){const t=(clock*.16+n/14)%1,angle=n*2.4+clock*.4;ctx.beginPath();ctx.arc(dx+(px+pw/2+Math.cos(angle)*pw*.4)*dw,dy+(py+ph*(1-t))*dh,2,0,Math.PI*2);ctx.fill();}ctx.restore();}
  ctx.restore();
  if(s.kind==='chart'){
   const scale=dw/image.width;this.chartPlacement={dx:x-anchor[0]*dw,dy:y-anchor[1]*dh,scale};for(const node of a.runtime.chartNodes??[]){const nx=x-anchor[0]*dw+node.x*scale,ny=y-anchor[1]*dh+node.y*scale;ctx.fillStyle=color('--color-text-primary');ctx.font=getComputedStyle(document.documentElement).getPropertyValue('--font-size-caption')+' '+getComputedStyle(document.documentElement).getPropertyValue('--font-family');ctx.textAlign='center';ctx.fillText(node.name,nx,ny+35*scale);if(node.id===this.selection){ctx.strokeStyle=color('--color-highlight');ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(nx,ny,38*scale,27*scale,0,0,Math.PI*2);ctx.stroke();}}
  }
 }
 selectAt(x:number,y:number){const a=this.asset,place=this.chartPlacement;if(!a?.runtime.chartNodes||!place)return;const {dx,dy,scale}=place;const n=a.runtime.chartNodes.find(n=>Math.hypot(x-(dx+n.x*scale),y-(dy+n.y*scale))<40*scale);if(n)this.selection=n.id;return n;}
 diagnostics(){return {id:this.asset?.id,file:this.state?.file,ready:Boolean(this.image),visible:this.state?.visible!==false,stateAnnotation:this.state?.annotation,imageDifference:this.state?.imageDifference,programLight:Boolean(this.state?.light),programPortal:Boolean(this.state?.portal),chartSelection:this.selection,referenceScale:this.state?.referenceScale,referenceFootprint:this.state?.referenceFootprint,foot:{x:360,y:320}};}
}
