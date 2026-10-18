export const pets=[
 {key:'wind',island:'风栖岛',name:'风绒',family:'D1',chapter:1,body:[.96,.94,.86],dark:[.03,.04,.04],accent:[.64,.94,1]},
 {key:'mist',island:'雾铃岛',name:'苔芽',family:'D3',chapter:2,body:[.58,.94,.73],dark:[.03,.1,.04],accent:[.8,.98,.88]},
 {key:'forge',island:'赤炉岛',name:'铜芯',family:'C4',chapter:3,body:[.94,.76,.59],dark:[.04,.04,.04],accent:[1,.69,.39]},
 {key:'frost',island:'霜镜岛',name:'霜羽',family:'C8',chapter:4,body:[.62,.85,1],dark:[.04,.1,.18],accent:[.65,.95,1]},
 {key:'dragon',island:'龙眠岛',name:'眠鳍',family:'A7',chapter:5,body:[1,.91,.7],dark:[.08,.07,.03],accent:[.5,.95,1]},
 {key:'star',island:'沉星岛',name:'星泡',family:'S9',chapter:6,body:[.92,.45,1],dark:[.08,.035,.1],accent:[.9,.96,1]}
];
export const forms=[{key:'young',stage:'a',height:44,label:'幼年'},{key:'adult',stage:'c',height:56,label:'成年'},{key:'awakened',stage:'e',height:68,label:'觉醒'},{key:'variant-b',stage:'b',height:44,label:'外观 b',variant:true},{key:'variant-d',stage:'d',height:44,label:'外观 d',variant:true}];
export function palette(pet,source,variant){if(variant)return {};
 const tints={},darkTints={};for(const slot of source.slots){const n=slot.name;if(/box|yan|eye/i.test(n))continue;
 const accent=/chi|qi|fin|ye|hua|chu|erduo|key|pao|guaiC8.*(mao|yu)/i.test(n);
 tints[n]=accent?pet.accent:pet.body;darkTints[n]=accent?pet.dark.map(v=>v*.5):pet.dark;
 }return {tints,darkTints};}
