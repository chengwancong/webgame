import Phaser from 'phaser';
import type {World} from '../../../packages/simulation/index.ts';
import {projectFx} from './skill-fx-layout.ts';
import environment from '../../../packages/asset-manifest/environment.v2.json';
export function preloadChapterArt(scene:Phaser.Scene){for(const id of ['tundra','abyss','dragonbone'] as const)scene.load.image('chapter-ground-'+id,environment.chapterGround[id]);}
/** Environment-only. No duplicate boss telegraphs, cast labels or spell images. */
export class ChapterEffects{
 private ambient:Phaser.GameObjects.Graphics;
 constructor(scene:Phaser.Scene,private reduced:()=>boolean){this.ambient=scene.add.graphics().setDepth(9500);}
 draw(w:World){this.ambient.clear();if(!['tundra','abyss','dragonbone'].includes(w.region.theme)||w.hero.hp<=0)return;const center=projectFx(w.hero.position),count=this.reduced()?8:32,color=w.region.theme==='tundra'?0xe7f6ff:w.region.theme==='abyss'?0xaa85d5:0xe9d5a0;this.ambient.fillStyle(color,w.region.theme==='abyss'?.1:.3);for(let n=0;n<count;n++){const x=center.x+((n*157+w.tick*(w.region.theme==='dragonbone'?3:.3))%1400)-700,y=center.y+((n*73+w.tick*.7)%800)-400;this.ambient.fillCircle(x,y,w.region.theme==='dragonbone'?1:2);}}
 destroy(){this.ambient.destroy();}
}
