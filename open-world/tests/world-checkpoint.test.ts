import {it,expect} from 'vitest';
import {World} from '../packages/simulation/index.ts';
import {regionById,skillCatalog} from '../packages/content/index.ts';
import type {Stats} from '../packages/contracts/index.ts';
const stats:Stats={hp:900,attack:30,armor:5,speed:6,mana:100,regen:10,effects:['burn']};
const create=()=>new World(regionById('meadow'),stats,skillCatalog.filter(s=>['cut','bolt','ward'].includes(s.id)),regionById('meadow').spawns,[],41);
it('captures and restores pending casts, projectiles, monster delays and RNG without callbacks',()=>{
 const a=create();a.radius=100;a.setMode('auto');for(let i=0;i<160;i++)a.step();const serialized=JSON.parse(JSON.stringify(a.exportCheckpoint())),b=World.restore(serialized);
 for(let i=0;i<120;i++){a.step();b.step();}expect(b.exportCheckpoint()).toEqual(a.exportCheckpoint());
});
it('runs separate heroes against shared enemies and restores their exact combat state',()=>{
 const a=create();a.addPlayer('a',stats,skillCatalog.filter(s=>['cut','bolt'].includes(s.id)));a.addPlayer('b',stats,skillCatalog.filter(s=>['cut','mend'].includes(s.id)));for(const id of ['a','b'])a.forPlayer(id,()=>{a.radius=100;a.setMode('auto');});
 for(let i=0;i<90;i++)a.step();const b=World.restore(JSON.parse(JSON.stringify(a.exportCheckpoint())));for(let i=0;i<60;i++){a.step();b.step();}expect(b.exportCheckpoint()).toEqual(a.exportCheckpoint());expect(a.players.size).toBe(2);expect(a.enemies.length).toBe(regionById('meadow').spawns.length);
});
it('party magic heals a real target and disconnected heroes still take damage',()=>{
 const a=create();a.addPlayer('a',stats,skillCatalog.filter(s=>s.id==='mend'));a.addPlayer('b',stats,[]);a.players.get('b')!.hero.hp=300;expect(a.castAlly('a','b','mend',6)).toBe(true);for(let i=0;i<20;i++)a.step();expect(a.players.get('b')!.hero.hp).toBeGreaterThan(300);
 const enemy=a.enemies.find(e=>e.kind==='melee')!;enemy.position={...a.players.get('b')!.hero.position};enemy.cooldown=0;a.setConnected('b',false);const before=a.players.get('b')!.hero.hp;for(let i=0;i<60;i++)a.step();expect(a.players.get('b')!.hero.hp).toBeLessThan(before);
});
it('checkpoint rejects unsupported versions, unknown fields and invalid actor data rather than silently initializing a new battle',()=>{
 const a=create(),c=a.exportCheckpoint();expect(()=>World.restore({...c,version:2} as any)).toThrow();expect(()=>World.restore({...c,data:{...c.data,missingMechanism:true}})).toThrow();expect(()=>World.restore({...c,data:{...c.data,tick:NaN}})).toThrow();expect(()=>World.restore({...c,data:{...c.data,hero:{...c.data.hero,hp:-1}}})).toThrow();
});
