import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import type {World} from '../../../packages/simulation/index.ts';
import {hexCooldownViewSchema,type HexCooldownView} from '../../../packages/contracts/hex-runes.ts';
import {hexCombatLedgerSchema} from '../../../packages/simulation/hex-cooldowns.ts';
const storedSchema=z.object({readyAt:z.record(z.string(),z.number().finite().nonnegative()),seen:z.record(z.string(),z.string()),deaths:z.number().int().nonnegative()}).strict();
const empty=()=>({readyAt:{} as Record<string,number>,seen:{} as Record<string,string>,deaths:0});
function live(readyAt:Record<string,number>,now:number){return Object.fromEntries(Object.entries(readyAt).filter(([,until])=>until>now));}
/** Private additive table. Public commands cannot submit deadlines, trigger
 * counts, death counts or checkpoints to it. Call only with a server World. */
export async function readHexCooldowns(c:Pool|PoolClient,character:string,now=Date.now()):Promise<HexCooldownView>{
 const row=(await c.query('SELECT data FROM ow_hex_cooldowns WHERE character=$1',[character])).rows[0];
 return hexCooldownViewSchema.parse({observedAt:now,readyAt:row?live(storedSchema.parse(row.data).readyAt,now):{}});
}
/** Adopt a new authoritative instance under the existing character lock.
 * A stale former instance cannot overwrite the new instance's ledger. */
export async function enterHexCombat(c:PoolClient,character:string,scope:string,world:World,player=world.playerId,now=Date.now()){
 if(!scope||!Number.isFinite(now))throw Error('Invalid HEX combat source');
 await c.query("INSERT INTO ow_hex_cooldowns(character,scope,data) VALUES($1,$2,$3) ON CONFLICT(character) DO NOTHING",[character,scope,empty()]);
 const row=(await c.query('SELECT scope,data FROM ow_hex_cooldowns WHERE character=$1 FOR UPDATE',[character])).rows[0],data=storedSchema.parse(row.data);
 data.readyAt=live(data.readyAt,now);
 if(row.scope!==scope){data.seen={};data.deaths=0;}
 world.forPlayer(player,()=>{world.hexLedger??={deaths:0,triggers:{}};const at=Math.max(world.tick,world.players.get(player)?.activeFrom??world.tick);for(const [key,until] of Object.entries(data.readyAt))world.comboReady[key]=Math.max(world.comboReady[key]??0,at+Math.ceil((until-now)*30/1000));});
 await c.query('UPDATE ow_hex_cooldowns SET scope=$2,data=$3 WHERE character=$1',[character,scope,data]);
}
/** Writes only newly observed server triggers. Re-saving a paused/reconnected
 * checkpoint never extends a deadline. Death clears only the active source. */
export async function persistHexCombat(c:PoolClient,character:string,scope:string,world:World,player=world.playerId,now=Date.now()){
 let observed:World['hexLedger'];world.forPlayer(player,()=>{
  // Upgrade an already-running trusted pre-ledger checkpoint once. Never infer
  // from an HTTP body, and never manufacture a trigger for an expired ICD.
  if(!world.hexLedger){const prior=Object.entries(world.comboReady).filter(([key,ready])=>/^hex:[a-z0-9-]+$/.test(key)&&ready>world.tick);if(prior.length)world.hexLedger={deaths:0,triggers:Object.fromEntries(prior.map(([key,ready])=>[key,{tick:world.tick,ready}]))};}
  observed=world.hexLedger;
 });
 if(!observed)return;
 const ledger=hexCombatLedgerSchema.parse(observed);
 await c.query("INSERT INTO ow_hex_cooldowns(character,scope,data) VALUES($1,$2,$3) ON CONFLICT(character) DO NOTHING",[character,scope,empty()]);
 const row=(await c.query('SELECT scope,data FROM ow_hex_cooldowns WHERE character=$1 FOR UPDATE',[character])).rows[0];
 if(!row||row.scope!==scope)return;
 const data=storedSchema.parse(row.data);let changed=false;
 if(ledger.deaths<data.deaths)return; // stale pre-death world
 if(ledger.deaths>data.deaths){data.readyAt={};data.seen={};data.deaths=ledger.deaths;changed=true;}
 for(const [key,trigger] of Object.entries(ledger.triggers)){
  const token=trigger.tick+':'+trigger.ready;if(data.seen[key]===token)continue;
  const previous=data.seen[key];if(previous&&Number(previous.split(':')[0])>trigger.tick)continue;
  data.seen[key]=token;changed=true;
  const until=now+Math.max(0,trigger.ready-world.tick)*1000/30;
  if(until>now)data.readyAt[key]=Math.max(data.readyAt[key]??0,until);
 }
 if(changed){data.readyAt=live(data.readyAt,now);await c.query('UPDATE ow_hex_cooldowns SET data=$2 WHERE character=$1',[character,data]);}
}
