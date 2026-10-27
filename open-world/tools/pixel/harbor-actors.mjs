import {Pixels,ramps,source,crop,resize,cleanup,provenance} from './harbor-source.mjs';
const pawn='Units/Blue Units/Pawn/',files={idle:'Pawn_Idle.png',move:'Pawn_Run.png',attack:'Pawn_Interact Knife.png',skill:'Pawn_Interact Hammer.png',projectile:'Pawn_Interact Knife.png',hurt:'Pawn_Idle.png',death:'Pawn_Idle.png'};
/** Constant source origin and scale across every clip prevent breathing-size and foot jitter. */
async function body(action,n,clip,captain=false){const file=pawn+files[action],sheet=await source(file),count=sheet.width/192,active=['attack','skill','projectile'].includes(action),index=active?Math.min(count-1,n<clip.impactFrame?Math.floor(n/Math.max(1,clip.impactFrame)*Math.min(2,count)):Math.floor(count*.5+(count*.5-1)*(n-clip.impactFrame)/Math.max(1,clip.count-1-clip.impactFrame))):Math.floor(n/clip.count*count),frame=crop(sheet,index*192,0,192,192),out=new Pixels(64,64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const sx=Math.round((x-32)*4/3+96),sy=Math.round((y-60)*4/3+128);if(sx<0||sx>=192||sy<0||sy>=192)continue;const i=(sy*192+sx)*4;if(!frame.data[i+3])continue;let c='#'+frame.data.subarray(i,i+3).toString('hex');
  // The source's brown hair is adapted to the white-haired explorer in the direction reference.
  if(y<39){const hairMap={[ramps.skin[2]]:captain?ramps.navy[2]:ramps.ink[5],[ramps.ink[2]]:captain?ramps.navy[1]:ramps.ink[4]};c=hairMap[c]??c;}
  out.dot(x,y,c);
 }
 let hand=[45,50];if(active){const phase=n<clip.impactFrame?0:n===clip.impactFrame?1:2;hand=[[42,39],[48,47],[43,50]][phase];}
 if(captain){out.poly([[15,23],[21,14],[34,14],[41,20],[42,25],[16,25]],ramps.navy[0]);out.rect(20,17,17,5,ramps.navy[2]);out.rect(29,18,3,3,ramps.copper[4]);out.rect(18,25,25,2,ramps.navy[0]);out.poly([[27,46],[34,48],[42,44],[40,53],[34,56],[29,53]],ramps.ink[4]);out.poly([[29,47],[34,50],[40,46],[37,53],[33,54]],ramps.ink[5]);}
 if(action==='death'&&n>=3){const flat=resize(out,64,28),p=new Pixels(64,64);p.stamp(flat,0,32);return{pixels:cleanup(p),file,hand:[44,55]};}
 if(action==='hurt'){const shifted=new Pixels(64,64);shifted.stamp(out,-2,0);return{pixels:cleanup(shifted),file,hand:[hand[0]-2,hand[1]]};}
 return{pixels:cleanup(out),file,hand};
}
export async function actorSheet(asset,oldWeapon,{captain=false}={}){const actions=structuredClone(asset.actions),rows=Math.max(...Object.values(actions).map(a=>a.row+1)),cols=Math.max(...Object.values(actions).map(a=>a.count)),bodySheet=new Pixels(cols*64,rows*64),weaponSheet=new Pixels(cols*64,rows*64),full=new Pixels(cols*64,rows*64),used=new Set();
 for(const[name,clip]of Object.entries(actions))for(let n=0;n<clip.count;n++){const action=name.split(':').at(-1),f=await body(files[action]?action:'skill',n,clip,captain),old=clip.sockets[n],dx=f.hand[0]-old.hand[0],dy=f.hand[1]-old.hand[1],held=new Pixels(64,64);used.add(f.file);
  if(oldWeapon)held.stamp(crop(oldWeapon,n*64,clip.row*64,64,64),dx,dy);
  const points={};for(const[k,v]of Object.entries(old))points[k]=v.map((c,i)=>Math.max(0,Math.min(63,c+(i?dy:dx))));points.feet=[32,60];points.chest=[32,45];points.hand=f.hand;clip.sockets[n]=points;
  const combined=new Pixels(64,64);combined.stamp(f.pixels,0,0);combined.stamp(held,0,0);bodySheet.stamp(f.pixels,n*64,clip.row*64);weaponSheet.stamp(cleanup(held),n*64,clip.row*64);full.stamp(cleanup(combined),n*64,clip.row*64);
 }
 return{body:bodySheet,weapon:weaponSheet,full,actions,provenance:provenance([...used],['48px chibi white-haired explorer / navy captain','source poses retimed onto unchanged game clocks and impact boundaries','existing named attachment sockets realigned'])};
}
