import type {Receipt} from '../../../packages/contracts/index.ts';
type ProgressionDelta=NonNullable<Receipt['delta']['progression']>;
/** Compose already-awarded gains for the one receipt/ledger transaction. This
 * never awards either source twice or mutates the character a second time. */
export function mergeDungeonProgression(left:ProgressionDelta|undefined,right:ProgressionDelta):ProgressionDelta{
 const add=(a:Record<string,number>,b:Record<string,number>)=>{const out={...a};for(const [key,amount]of Object.entries(b))out[key]=(out[key]??0)+amount;return out;};
 return {materials:add(left?.materials??{},right.materials),reputation:add(left?.reputation??{},right.reputation)};
}
