import {it,expect} from 'vitest';
import {StarseaController} from '../apps/web/src/starsea-controller.ts';
import {dialogueToastText} from '../apps/web/src/automatic-quest-dialogue.ts';

const lines=[{speaker:'领航员·米洛',text:'喂——别动！你脚边就是岛缘，下面是星潮。'},{speaker:'你',text:'刻片……刚才还亮着。'},{speaker:'领航员·米洛',text:'站我旁边。'}];

function controller(hub:boolean){
 const opened:string[]=[],notices:string[]=[];
 const c=new StarseaController({snapshot:()=>undefined,world:()=>({region:{id:'ss-map-port'}}) as never,settle:async()=>{},write:async()=>undefined,travel:async()=>false,open:p=>opened.push(p),refresh:()=>{},notice:t=>notices.push(t),lastError:()=>'',ensurePermit:async()=>{},service:()=>{},panel:()=>'',hubMode:()=>hub});
 return {c:c as unknown as {popup(title:string,l:typeof lines):void},opened,notices};
}

it('dialogueToastText keeps only the first line, with speaker, truncated',()=>{
 expect(dialogueToastText(lines)).toBe('领航员·米洛：喂——别动！你脚边就是岛缘，下面是星潮。');
 expect(dialogueToastText([{speaker:'',text:'字'.repeat(60)}])).toBe('字'.repeat(39)+'…');
 expect(dialogueToastText([])).toBeUndefined();
});

it('HUB mode turns multi-line task popups into one notice and never opens the talk window',()=>{
 const hub=controller(true);
 hub.c.popup('落点求生',lines);hub.c.popup('抢救船台',lines);
 expect(hub.opened).toEqual([]);
 expect(hub.notices).toEqual([dialogueToastText(lines),dialogueToastText(lines)]);
});

it('outside HUB mode the old talk window still plays',()=>{
 const old=controller(false);
 old.c.popup('落点求生',lines);
 expect(old.opened).toEqual(['starsea-talk']);
 expect(old.notices).toEqual([]);
});
