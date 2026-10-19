export type ReleaseVersions={client:string;protocol:number;rules:string;assets:string;db:number};
export function committedVersions(source:string):ReleaseVersions{
 const match=source.match(/export const versions=\{client:'([^']+)',protocol:(\d+),rules:'([^']+)',assets:'([^']+)',db:(\d+)\}/);
 if(!match)throw Error('Cannot read committed release versions');
 return {client:match[1],protocol:Number(match[2]),rules:match[3],assets:match[4],db:Number(match[5])};
}
export function assertReleaseVersions(actual:Partial<ReleaseVersions>|undefined,expected:ReleaseVersions){
 for(const key of ['client','protocol','rules','assets','db'] as const)if(actual?.[key]!==expected[key])throw Error(`Release ${key} mismatch: expected=${expected[key]}, actual=${actual?.[key]??'missing'}`);
}
