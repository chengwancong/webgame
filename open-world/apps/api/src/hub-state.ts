import type {Pool,PoolClient} from 'pg';
import {normalizeHubState,type HubState} from '../../../packages/rules/hub-state.ts';
export type {HubState} from '../../../packages/rules/hub-state.ts';
/** Additive schema only. The db 19 marker belongs to switch S, never this helper. */
export async function migrateHub(c:PoolClient){await c.query(`CREATE TABLE IF NOT EXISTS ow_hub_state(character uuid PRIMARY KEY REFERENCES ow_characters(id),state jsonb NOT NULL DEFAULT '{}')`);}
/** Caller owns a transaction and the ow_characters row lock before changing this state. */
export async function readHubState(c:Pool|PoolClient,character:string,now=Date.now()):Promise<HubState>{const r=await c.query('SELECT state FROM ow_hub_state WHERE character=$1',[character]);return normalizeHubState(r.rows[0]?.state,now);}
export async function saveHubState(c:PoolClient,character:string,state:HubState){await c.query('INSERT INTO ow_hub_state(character,state) VALUES($1,$2) ON CONFLICT(character) DO UPDATE SET state=EXCLUDED.state',[character,state]);}
