export const forms=[{key:'young',height:44,label:'幼年'},{key:'adult',height:56,label:'成年'},{key:'awakened',height:68,label:'觉醒'}];
const common={island:'龙眠',islandKey:'dragon',chapter:5,palette:['#e6cea0','#b0966b','#75b6c3','#4c8497']};
export const pets=[
 {...common,key:'dragon-free',tier:'free',name:'零氪·眠角',family:'D2',stages:['a','c','e'],heights:[44,56,68]},
 {...common,key:'dragon-light',tier:'light',name:'轻氪·晓翼',family:'A10',stages:['a','c','e'],heights:[48,62,74]},
 {...common,key:'dragon-heavy-a',tier:'heavy',style:'A',name:'重氪 A·精绘',family:'A7',stages:['c','d','e'],heights:[54,70,84]},
 {...common,key:'dragon-heavy-b',tier:'heavy',style:'B',name:'重氪 B·精绘饰甲',family:'A7',stages:['c','d','e'],heights:[54,70,84]}
];
export const materialNames=['body','shadow','pattern','patternShadow','belly','outlineAndEyes','eyeLight','blush','deepShadow','bodyLight','rim','metal','metalShadow','metalLight','gem','gemLight'];
export const colors=p=>[...p.palette,'#fff7e6','#3c2b23','#ffffff','#e8b7a4','#816846','#f5dfb5','#fff0cf','#d8b574','#947046','#fff1b3','#6cb9cf','#dffcff'];
export function palette(){return {};}
