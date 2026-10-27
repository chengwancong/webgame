import {it,expect,vi} from 'vitest';
import type {PixelAsset} from '../apps/web/src/pixel-assets.ts';
import master from '../packages/asset-manifest/pixel-palette.json';
const fixture=vi.hoisted(()=>({assets:{} as Record<string,PixelAsset>}));
vi.mock('../apps/web/src/pixel-assets.ts',async original=>({...await original<typeof import('../apps/web/src/pixel-assets.ts')>(),pixelAsset:(key:string)=>fixture.assets[key]}));
import {authoredActorFrame,authoredActorPose,pixelFeedbackTint} from '../apps/web/src/pixel-actor-view.ts';
function actor(){
 const sockets=Array.from({length:6},(_,i)=>({feet:[32,60],chest:[32,31],hand:[42,35],weapon:[50+i,28],muzzle:[50+i,28]}));
 const asset={file:'/art-pixel/test.png',frame:[64,64],anchor:[32,60],kind:'actor',actions:{attack:{row:0,count:6,duration:1,impactTime:.4,impactFrame:2,frameTimes:[0,.2,.4,.6,.8,.9],sockets},cast:{row:1,count:6,duration:1,impactTime:.4,impactFrame:2,frameTimes:[0,.2,.4,.6,.8,.9],sockets}}} as unknown as PixelAsset;
 fixture.assets={'ss-mon-dusk-blade':asset};
 const data:Record<string,any>={'pixel-art-id':'ss-mon-dusk-blade','pixel-facing':1,'pixel-clock':{action:'attack',seconds:.45}};
 const image:any={x:100,y:200,texture:{key:'ss-mon-dusk-blade'},frame:{name:'attack_0'},flipX:true,anims:{isPlaying:true},getData:(key:string)=>data[key]};return{image,data,asset};
}
it('advances new frames from the continuous original action clock even when the old raster frame is held',()=>{
 const a=actor();expect(authoredActorFrame(a.image)?.index).toBe(2);a.image.texture.key='pixel-authored:test';a.image.frame.name='attack_2';a.data['pixel-clock'].seconds=.85;expect(authoredActorFrame(a.image)?.index).toBe(4);
});
it('mirrors the authored weapon tip around the same foot and resolves the release pose separately',()=>{
 const a=actor(),right=authoredActorPose(a.image,'ss-mon-dusk-blade')!;expect(right.flip).toBe(false);expect(right.socket!('weapon',right.releaseFrame!)).toEqual({x:140,y:136});
 a.data['pixel-facing']=-1;const left=authoredActorPose(a.image,'ss-mon-dusk-blade')!;expect(left.socket!('weapon',left.releaseFrame!)).toEqual({x:60,y:136});
});
it('maps the existing cast release boundary to its authored impact frame',()=>{
 const a=actor();a.image.frame.name='idle_0';a.data['pixel-cast']={action:'cast',elapsed:1,windup:1,recovery:.5};expect(authoredActorFrame(a.image)?.name).toBe('cast');expect(authoredActorFrame(a.image)?.index).toBe(2);
});
it('keeps damage-flash fills inside the shared master palette',()=>{
 const palette=Object.values(master.ramps).flat().map(c=>parseInt(c.slice(1),16));for(const color of [0xffffff,0xff0000,0x00ffff,0x993377])expect(palette).toContain(pixelFeedbackTint(color));
});
it('uses native x1 sockets for the fine-density actor instead of doubling its coordinates again',()=>{const a=actor();a.asset.frame=[128,128];a.asset.anchor=[64,120];a.asset.scale=1;a.asset.actions!.attack.sockets=a.asset.actions!.attack.sockets.map(s=>({...s,weapon:[90,92]}));const pose=authoredActorPose(a.image,'ss-mon-dusk-blade')!;expect(pose.scale).toBe(1);expect(pose.socket!('weapon',pose.releaseFrame!)).toEqual({x:126,y:172});});
