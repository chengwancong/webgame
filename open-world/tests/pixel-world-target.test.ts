import {it,expect,vi} from 'vitest';
import {PixelWorldTarget} from '../apps/web/src/pixel-world-target.ts';
function fixture(){
 const main={id:1,scrollX:12,scrollY:22,roundPixels:false},text:any={type:'Text',cameraFilter:1,scene:true},sprite:any={type:'Sprite',cameraFilter:0,scene:true};
 const cam={setZoom:vi.fn(),setScroll:vi.fn(),id:0,roundPixels:false};
 const target:any={texture:{setFilter:vi.fn()},camera:cam,type:'RenderTexture',cameraFilter:0,scene:true,clear:vi.fn(),draw:vi.fn(),destroy:vi.fn()};
 for(const name of ['setOrigin','setScrollFactor','setScale','setDepth'])target[name]=vi.fn(()=>target);
 const scene:any={cameras:{main},children:{list:[sprite,text]},add:{renderTexture:vi.fn(()=>{scene.children.list.push(target);return target;})}};
 return {scene,main,text,sprite,target,cam};
}
it('draws the world once at 640x360 and leaves text to its full-resolution camera',()=>{
 const f=fixture(),world=new PixelWorldTarget(f.scene);world.render();
 expect(f.scene.add.renderTexture).toHaveBeenCalledWith(0,0,640,360);expect(f.cam.setZoom).toHaveBeenCalledWith(.5);
 expect(f.target.draw).toHaveBeenCalledWith([f.sprite]);expect(f.target.setScale).toHaveBeenCalledWith(2);
 expect(f.sprite.cameraFilter&1).toBe(1);expect(f.text.cameraFilter&1).toBe(1);
 world.destroy();expect(f.sprite.cameraFilter&1).toBe(0);expect(f.text.cameraFilter&1).toBe(1);expect(f.main.roundPixels).toBe(false);
});
it('restores camera masking even when a world draw fails',()=>{
 const f=fixture(),world=new PixelWorldTarget(f.scene);f.target.draw.mockImplementation(()=>{expect(f.sprite.cameraFilter&1).toBe(0);throw Error('render failed');});
 expect(()=>world.render()).toThrow('render failed');expect(f.sprite.cameraFilter&1).toBe(1);world.destroy();expect(f.sprite.cameraFilter&1).toBe(0);
});
