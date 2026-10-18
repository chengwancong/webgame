import {afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
const original=process.env.AW_DATABASE_URL;if(!original)throw Error('Playability regression requires real isolated PostgreSQL');
const schema='qa_playability_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:original,max:1});
await owner.query('CREATE SCHEMA '+schema);
const url=new URL(original);url.searchParams.set('options','-c search_path='+schema);process.env.AW_DATABASE_URL=url.href;
// Setup runs before each test module is imported. Cleanup runs after its own hooks.
// Minimal persistence fixtures can never enter another file's migration or be mistaken for real characters.
afterAll(async()=>{await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();process.env.AW_DATABASE_URL=original;});
