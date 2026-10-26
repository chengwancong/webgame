// 剧情副本段裁图（2026-10-26 抢救船台进图只剩底色）：每一段都要能从源岛地图裁出同尺寸画面。
import {it,expect} from 'vitest';
import '../packages/content/dungeons.ts';
import {hubStorySegments} from '../packages/content/hub-dungeon-templates.ts';
import {regionById} from '../packages/content/index.ts';
import {fieldMaps} from '../packages/content/open-world/index.ts';
import {cropOrigin,storyCropMap} from '../apps/web/src/story-crop-map.ts';
import type {StarseaMap} from '../apps/web/src/starsea-world-renderer.ts';

it('每个剧情副本段都裁得出地图，尺寸与碰撞区一致，地标平移到段内',()=>{
 expect(hubStorySegments.size).toBe(18);
 for(const parts of hubStorySegments.values())for(const part of parts){
  const region=regionById(part.region),origin=cropOrigin(region.presentationKey)!;
  expect(origin,part.region).toBeTruthy();
  const map=storyCropMap(region,fieldMaps)!,source=fieldMaps[origin.source] as StarseaMap;
  expect(map,part.region).toBeTruthy();
  expect([map.id,map.width,map.height]).toEqual([region.id,region.width,region.height]);
  expect(map.boundary.points).toBeUndefined();
  for(const l of map.landmarks){const s=source.landmarks.find(x=>x.id===l.id)!;expect([l.x,l.y]).toEqual([s.x-origin.x,s.y-origin.y]);}
  expect(storyCropMap(region,fieldMaps)).toBe(map);
 }
});
