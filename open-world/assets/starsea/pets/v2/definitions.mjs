export const pets=[
{key:'wind',name:'风绒',family:'D1',stages:['a','c','d'],island:'风栖',chapter:1,fur:true,palette:['#f4edda','#cbb694','#78b9c4','#528c99']},
{key:'mist',name:'苔芽',family:'D3',stages:['a','c','d'],island:'雾铃',chapter:2,palette:['#9fbc83','#617c53','#e9c1c7','#ad7889']},
{key:'forge',name:'炉鬃',family:'C6',stages:['a','c','e'],island:'赤炉',chapter:3,palette:['#b1a295','#746459','#e79453','#b84b35']},
{key:'frost',name:'霜团',family:'B5',stages:['a','c','e'],island:'霜镜',chapter:4,fur:true,palette:['#e5f0ef','#9badbd','#89b7cd','#537a97']},
{key:'dragon',name:'眠角',family:'D2',stages:['a','c','e'],island:'龙眠',chapter:5,palette:['#e6cea0','#b0966b','#75b6c3','#4c8497']},
{key:'star',name:'星漪',family:'B1',stages:['a','c','e'],island:'沉星',chapter:6,palette:['#aaa2bd','#726780','#c6b8d6','#8b75a6']}
];
export const forms=[{key:'young',height:44,label:'幼年'},{key:'adult',height:56,label:'成年'},{key:'awakened',height:68,label:'觉醒'}];
export const materialNames=['body','shadow','accent','accentShadow','belly','outline','highlight','blush'];
export const colors=p=>[...p.palette,'#fff7e6','#3c2b23','#ffffff','#e8b7a4'];
export function palette(){return {};}
