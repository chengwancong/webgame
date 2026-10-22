import type {FieldFreeze} from '../../../packages/contracts/field-freeze.ts';

export const HUB_FIELD_FROZEN={code:'FIELD_FROZEN',message:'旧野外功能已冻结，请从拾星港星门出发。'} as const;
type CommandBody={operation?:string;op?:string;region?:string;sprint?:boolean};
/** Runs inside the existing write transaction AFTER receipt replay. It never blocks
 * old combat settlement, activity claims, or dungeon completion/return. */
export function hubFrozenCommand(flags:Readonly<FieldFreeze>,body:CommandBody):keyof FieldFreeze|null{
 if(flags.fieldGather&&body.operation==='field.gather')return 'fieldGather';
 if(flags.fieldSprint&&(body.operation==='field.sprint'||body.sprint===true))return 'fieldSprint';
 if(!flags.fieldEntry)return null;
 if(body.operation==='plane.interact')return 'fieldEntry';
 if(['location','safe'].includes(body.operation??'')&&body.region!=='ss-map-port')return 'fieldEntry';
 if(body.operation==='starsea.quest'&&['travel','gate','start','waypoint','arrive'].includes(body.op??'')&&body.region!=='ss-map-port')return 'fieldEntry';
 return null;
}
/** Sprint is currently automatic, not a separately toggleable command. Remove its
 * capability in the public region AND authoritative field World at construction. */
export function frozenFieldRegion<T extends {sprint?:boolean}>(region:T,flags:Readonly<FieldFreeze>):T{
 return flags.fieldSprint?{...region,sprint:false}:region;
}
