/** Structural conversion; retain source vertices, weights, transforms and keyframe times. */
export function upgradeSpine21(input){
 const raw=structuredClone(input),changes=[];if(!String(raw.skeleton?.spine).startsWith('2.1'))return {raw,changes,mode:'spine-runtime-export'};
 raw.skeleton={...raw.skeleton,spine:'3.6.53'};
 for(const b of raw.bones??[]){if(b.inheritRotation===false&&b.inheritScale===false)b.transform='onlyTranslation';else if(b.inheritRotation===false)b.transform='noRotationOrReflection';else if(b.inheritScale===false)b.transform='noScale';delete b.inheritRotation;delete b.inheritScale;}
 for(const s of raw.slots??[])if(s.additive){s.blend='additive';delete s.additive;}
 for(const skin of Object.values(raw.skins??{}))for(const attachments of Object.values(skin))for(const a of Object.values(attachments)){if(['skinnedmesh','weightedmesh'].includes(a.type)){a.type='mesh';changes.push('weighted mesh vertices retained');}if(a.type==='weightedlinkedmesh')a.type='linkedmesh';}
 for(const a of Object.values(raw.animations??{}))if(a.ffd){a.deform=a.ffd;delete a.ffd;changes.push('ffd -> deform');}
 changes.push('2.1 -> 3.6 fields; timing unchanged');return {raw,changes:[...new Set(changes)],mode:'spine21-converted-runtime'};
}
export function physicalSlotAllowed(id,name){
 if(id==='blade-streak')return !/^zi\d*$/.test(name);
 if(id==='ground-crater')return name==='dilie';
 if(id==='ground-ring')return name==='yinboquan_a1';
 if(id==='ground-dust')return name==='yanwu';
 if(id==='ground-crack')return /^dilie[12]$/.test(name);
 if(id==='ground-rock')return name==='suishi_s1';return true;
}
export function attachmentSequence(raw,id){
 const duration=a=>{let end=0;const visit=x=>{if(Array.isArray(x))for(const v of x)visit(v);else if(x&&typeof x==='object'){if(Number.isFinite(x.time))end=Math.max(end,x.time);for(const v of Object.values(x))visit(v);}};visit(a);return end;};
 const [name,a]=Object.entries(raw.animations??{}).sort((x,y)=>duration(y[1])-duration(x[1]))[0]??['setup',{}],slot=(raw.slots??[]).filter(s=>physicalSlotAllowed(id,s.name)).sort((x,y)=>(a.slots?.[y.name]?.attachment?.length??0)-(a.slots?.[x.name]?.attachment?.length??0))[0];if(!slot)throw Error('No atlas sequence '+id);
 const timeline=a.slots?.[slot.name]?.attachment??[],skin=raw.skins?.default?.[slot.name]??{};return {name,duration:Math.max(1/30,duration(a)),regionAt(t){let n=slot.attachment;for(const k of timeline)if((k.time??0)<=t)n=k.name;return n?(skin[n]?.path??n):null;}};
}
