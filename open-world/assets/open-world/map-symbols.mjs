/** Simple map glyphs extend the existing native SVG symbol system. */
export const symbols=[
 {id:'waypoint-inactive',name:'传送点 · 未解锁',tone:'TextDisabled',shape:'<path d="M18 52V20h28v32M12 52h40M23 28h18M23 38h18"/><path d="M32 8v10"/>',state:'inactive'},
 {id:'waypoint-active',name:'传送点 · 已解锁',tone:'Success',shape:'<path d="M18 52V20h28v32M12 52h40M23 28h18M23 38h18"/><path d="m25 10 5 5 9-9"/>',state:'active'},
 {id:'dungeon',name:'地城入口',tone:'TextPrimary',shape:'<path d="M8 52 15 24 25 13 40 12 50 25 56 52Z"/><path d="M23 52V35q9-16 18 0v17"/>'},
 {id:'event',name:'世界事件',tone:'Warning',shape:'<path d="M32 8 10 52h44Z"/><path d="M32 23v15m0 6v2"/>'},
 {id:'rare',name:'稀有精英',tone:'Danger',shape:'<path d="m13 42-5-22 15 9 9-20 9 20 15-9-5 22ZM15 51h34"/>'},
 {id:'chest',name:'宝箱',tone:'Highlight',shape:'<rect x="10" y="23" width="44" height="30" rx="5"/><path d="M10 33h44M19 23v30m26-30v30"/><rect x="28" y="30" width="8" height="13" rx="2"/>'},
 {id:'quest',name:'任务目标',tone:'PrimaryBorder',shape:'<path d="M20 9h24v45H20Z"/><path d="M27 21h10m-10 10h10m-10 10h7"/>'},
 {id:'outpost',name:'前哨营地',tone:'Success',shape:'<path d="m8 52 24-39 24 39Z"/><path d="m24 52 8-18 8 18M27 12l-5-8m15 8 5-8"/>'},
 {id:'boss',name:'首领门',tone:'Danger',shape:'<path d="M12 53V14h12v39m16 0V14h12v39M8 14h48M24 26h16v27H24Z"/><path d="M29 34h6m-6 8h6"/>'},
 {id:'zone',name:'分区标记',tone:'SecondaryText',shape:'<path d="m12 16 17-7 17 7 9-3v36l-10 5-17-7-16 6Z"/><path d="M29 10v36m17-30v38"/>'},
];
