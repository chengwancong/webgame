import {readFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {nativeKit,nativeBodyClass} from '../apps/web/src/native-kit.ts';
import {installSkillMotions,skillMotions,STILL} from '../apps/web/src/skill-motions.ts';
import {skillMotionNames} from '../apps/web/src/skill-motion-map.ts';
import {weaponTypes} from '../packages/contracts/weapons.ts';
import {resolvedAppearanceSchema} from '../packages/contracts/appearance.ts';
import {appearanceKit} from '../packages/rules/appearance.ts';
import {expandedSkills} from '../packages/content/skills-expanded.ts';

const rig=JSON.parse(readFileSync(new URL('../assets/mini-hero/navy/runtime/Character.json',import.meta.url),'utf8'));
const skins=new Set<string>(rig.skins.map((s:{name:string})=>s.name));
const ext=JSON.parse(readFileSync(new URL('../apps/web/public/art/mini-hero/extensions/extensions.json',import.meta.url),'utf8')) as {items:{id:string;file:string}[]};
const series=['standard','primal','omega'] as const,tiers=[1,2,3] as const;

describe('gear → native hero kit',()=>{
  it('resolves every weapon type, series and tier to real rig skins or registered extension art',()=>{
    for(const type of weaponTypes)for(const s of series)for(const tier of tiers){
      const kit=nativeKit({weapon:{type,series:s,tier},armor:{family:type,series:s,tier}});
      for(const name of [kit.body,kit.right,kit.left].filter(Boolean))expect(skins.has(name!),name).toBe(true);
      expect(kit.body.startsWith(`BODY/${nativeBodyClass[type]}_`)).toBe(true);
      if(type==='hammer'||type==='axe'){
        const item=ext.items.find(i=>i.id===kit.ext);expect(item,kit.ext).toBeTruthy();
        expect(existsSync(new URL('../apps/web/public/art/mini-hero/extensions/'+item!.file,import.meta.url))).toBe(true);
        expect(kit.right).toBeUndefined();
      }else expect(kit.ext).toBeUndefined();
      expect(Boolean(kit.left)).toBe(type==='hidden');
    }
  });
  it('gives each of the nine grades its own outfit and weapon',()=>{
    for(const type of weaponTypes){
      const kits=series.flatMap(s=>tiers.map(tier=>nativeKit({weapon:{type,series:s,tier},armor:{family:type,series:s,tier}})));
      expect(new Set(kits.map(k=>k.body)).size).toBe(9);expect(new Set(kits.map(k=>k.right??k.ext)).size).toBe(9);
    }
  });
  it('falls back to a plain outfit of the weapon class, then the starter knight',()=>{
    expect(nativeKit({weapon:{type:'bow',series:'standard',tier:1},armor:null}).body).toBe('BODY/archer_common1');
    const bare=nativeKit({weapon:null,armor:null});expect(bare.body).toBe('BODY/knight_common1');expect([bare.right,bare.ext,bare.muzzle]).toEqual([undefined,undefined,'hand']);
  });
  it('plays only clips that exist in the rig',()=>{
    for(const type of weaponTypes){const kit=nativeKit({weapon:{type,series:'standard',tier:1},armor:null});for(const motion of Object.values(kit.actions))expect(rig.animations[motion.name],motion.name).toBeTruthy();}
  });
});

describe('server-resolved appearance kit',()=>{
  const gear=(base:string,slot:'weapon'|'armor')=>({id:randomUUID(),base,slot});
  it('reports the real main-hand type and armor grade, and legacy bases by name prefix',()=>{
    const w=gear('primal-hammer-t2-weapon','weapon'),a=gear('omega-hidden-t3-armor','armor');
    expect(appearanceKit({gear:[w,a],equipment:{weapon:w.id,armor:a.id}} as never)).toEqual({weapon:{type:'hammer',series:'primal',tier:2},armor:{family:'hidden',series:'omega',tier:3}});
    const legacy=gear('omega-bow','weapon');
    expect(appearanceKit({gear:[legacy],equipment:{weapon:legacy.id}} as never)).toEqual({weapon:{type:'bow',series:'omega',tier:1},armor:null});
    expect(appearanceKit({gear:[],equipment:{}} as never)).toEqual({weapon:null,armor:null});
  });
  it('is part of the strict resolved appearance contract and stays optional for stored dungeon snapshots',()=>{
    const base={rig:'modular-hero',family:'sword',styleProfile:'v2-soft',revision:1,parts:Object.fromEntries(['head','body','hands','legs','feet','back','weapon'].map(s=>[s,{setId:'100011'}]))};
    expect(resolvedAppearanceSchema.safeParse(base).success).toBe(true);
    expect(resolvedAppearanceSchema.safeParse({...base,kit:{weapon:{type:'wand',series:'standard',tier:1},armor:null}}).success).toBe(true);
    expect(resolvedAppearanceSchema.safeParse({...base,kit:{weapon:{type:'wand',series:'standard',tier:4},armor:null}}).success).toBe(false);
  });
});

describe('authored skill motions',()=>{
  const animations=installSkillMotions({animations:{}}).animations as Record<string,{bones:Record<string,Record<string,{x?:number;y?:number}[]>>}>;
  it('covers every mapped skill with a baked motion and its in-place variant',()=>{
    const ids=new Set(expandedSkills.map(s=>s.id));
    for(const [skill,name] of Object.entries(skillMotionNames)){
      expect(ids.has(skill),skill).toBe(true);expect(skillMotions.some(m=>m.name===name),name).toBe(true);
      expect(animations[name]).toBeTruthy();expect(animations[name+STILL]).toBeTruthy();
    }
  });
  it('keeps pelvis and feet in place in the reduced-motion variant',()=>{
    for(const motion of skillMotions){
      const still=animations[motion.name+STILL].bones;
      for(const bone of ['pelvis','target_legR','target_legL'])for(const key of still[bone].translate)expect([key.x,key.y].every(v=>Math.abs(v??0)<1e-9),motion.name+'/'+bone).toBe(true);
    }
  });
});
