import {it,expect} from 'vitest';
import {roadCells} from '../apps/web/src/world-chunks.ts';
it('connects sparse authored road vertices across chunks without holes or duplicate cells',()=>{
 const cells=roadCells([[3,5],[70,5],[70,42]]),keys=new Set(cells.map(p=>p.join(',')));
 for(let x=3;x<=70;x++)expect(keys.has(x+',5')).toBe(true);
 for(let y=5;y<=42;y++)expect(keys.has('70,'+y)).toBe(true);
 expect(keys.size).toBe(cells.length);expect(roadCells([])).toEqual([]);
});
