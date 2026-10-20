import {expect,it} from 'vitest';
import {buildFieldCorridor,corridorContains,generateFieldCorridors} from '../tools/build-field-corridors.ts';
import {regionById,type Region} from '../packages/content/index.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import {readFile} from 'node:fs/promises';
const region=():Region=>({...regionById('meadow'),id:'corridor-test',width:32,height:32,obstacles:[],dynamicObstacles:[],safe:{x:3,y:16},spawns:[]});
it('derives a deterministic six-cell corridor without widening into distant walkable areas',()=>{
 const r=region(),a=buildFieldCorridor(r,'gate',[{id:'start',point:r.safe}],{x:27,y:16},{x:26,y:16});
 expect(buildFieldCorridor(r,'gate',[{id:'start',point:r.safe}],{x:27,y:16},{x:26,y:16})).toEqual(a);
 expect(corridorContains(a,{x:16.5,y:21.5})).toBe(true);
 expect(corridorContains(a,{x:16.5,y:22.5})).toBe(false);
 expect(corridorContains(a,{x:-.1,y:16})).toBe(false);
 for(const [y,start,end]of a.runs)for(let x=start;x<end;x++)expect(walkable(r,{x:x+.5,y:y+.5},a.bodyPadding)).toBe(true);
});
it('routes around obstacles rather than replacing them with a painted rectangle',()=>{
 const r=region();r.obstacles=[{x:13,y:11,w:4,h:10}];
 const c=buildFieldCorridor(r,'around',[{id:'start',point:r.safe}],{x:27,y:16},{x:26,y:16});
 expect(c.sources[0].path.length).toBeGreaterThan(2);
 expect(corridorContains(c,{x:14.5,y:16.5})).toBe(false);
});
it('rejects unreachable or blocked endpoints and return points outside the whitelist',()=>{
 const r=region();r.obstacles=[{x:14,y:0,w:3,h:32}];
 expect(()=>buildFieldCorridor(r,'unreachable',[{id:'start',point:r.safe}],{x:27,y:16},{x:26,y:16})).toThrow();
 expect(()=>buildFieldCorridor(r,'blocked',[{id:'start',point:r.safe}],{x:15,y:16},{x:15,y:16})).toThrow();
 expect(()=>buildFieldCorridor(region(),'return',[{id:'start',point:{x:3,y:16}}],{x:27,y:16},{x:27,y:29})).toThrow('Return point');
});
it('loads the formal production grid and validates the first authored sample',async()=>{
 const result=await generateFieldCorridors('ow-wind-plane-nest-cave'),c=result.corridors[0];
 expect(c.width).toBe(512);expect(c.sources.map(s=>s.id)).toContain('ow-wind-wp1');
 expect(corridorContains(c,c.target)).toBe(true);expect(corridorContains(c,c.returnPoint)).toBe(true);
 expect(c.id).toBe('ow-wind-plane-nest-cave');expect(result.corridors).toHaveLength(1);
});
it('reproduces the entire generated authored batch and preserves phases, endpoints and walkable cells',async()=>{
 const generated=await generateFieldCorridors(),stored=JSON.parse(await readFile('packages/content/field-corridors.json','utf8'));
 expect(generated).toEqual(stored);
 expect(generated.corridors.map(c=>c.id)).toEqual(['ow-wind-plane-nest-cave','ow-wind-plane-nest-crypt','ow-wind-plane-nest-maze']);
 for(const c of generated.corridors){
  const r=regionById(c.region);
  expect(c.halfWidth).toBe(6);expect(c.sources).toHaveLength(2);
  expect(corridorContains(c,c.target)).toBe(true);expect(corridorContains(c,c.returnPoint)).toBe(true);
  expect(c.runs.reduce((n,[_y,a,b])=>n+b-a,0)).toBe(c.cells);
  for(const [y,a,b]of c.runs)for(let x=a;x<b;x++)expect(walkable(r,{x:x+.5,y:y+.5},c.bodyPadding)).toBe(true);
  for(const source of c.sources)for(const p of source.path)expect(corridorContains(c,p)).toBe(true);
  expect(c.phase).toEqual({when:null,until:null,requires:null});
 }
});
