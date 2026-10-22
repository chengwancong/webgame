import type {FieldFreeze} from '../../../packages/contracts/field-freeze.ts';

/** Client-side gate for the server's fieldFreeze switches: a frozen subsystem offers no new entry,
 * marker or hint, but existing instances (accepted bounties, running events) stay visible and claimable. */
type Freeze=Readonly<Pick<FieldFreeze,'bounties'|'events'>>|undefined;

/** Outpost bounty board interaction ("打开悬赏板") is offered only while bounties are not frozen. */
export function boardEntryVisible(freeze:Freeze){return !freeze?.bounties;}
/** A field event point (scene object + minimap marker) is shown unless events are frozen and no run is in progress or awaiting claim. */
export function eventPointVisible(freeze:Freeze,status?:string){return !freeze?.events||status==='running'||status==='success';}
