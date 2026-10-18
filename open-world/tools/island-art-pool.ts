type Art={id:string;island?:string;theme?:string;category:string;runtime:{displayWidth?:number;file?:string;kind:string}};
export type Catalogue={scope:string;assets:Art[]};
/** Both map generators select only authored local or declared shared assets. */
export function islandArtPool(catalogues:Catalogue[],artIsland:string,category:string,theme?:string){return catalogues.flatMap(c=>c.assets.filter(a=>a.category===category&&(a.island===artIsland||(a.island==='shared'||!a.island)&&['road','water','mask'].includes(category)||!a.island&&c.scope==='wind-island-art-foundation'&&artIsland==='wind')&&(!theme||!a.theme||a.theme===theme)));}
