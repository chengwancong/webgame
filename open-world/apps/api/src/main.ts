import {poolFor,migrate,keepWarm} from './database.ts';
import {createApp} from './app.ts';
import {loadHubOutsideNumbers} from './hub-numbers.ts';
import serveStatic from '@fastify/static';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import hubRuntime from '../../../packages/content/hub-runtime.json' with {type:'json'};
import {parseFieldFreeze} from '../../../packages/contracts/field-freeze.ts';
const fieldFreeze=parseFieldFreeze(process.env.AW_FIELD_FREEZE===undefined?hubRuntime.fieldFreeze:JSON.parse(process.env.AW_FIELD_FREEZE));
const hubNumbers=loadHubOutsideNumbers();
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Set AW_DATABASE_URL to the independent open-world database.');
if(process.env.NODE_ENV==='production'&&!process.env.AW_ORIGINS)throw Error('Production must set AW_ORIGINS to the HTTPS game origin.');
const pool=poolFor(dsn,{warm:true});await migrate(pool);const warm=keepWarm(pool);await warm.ready;
const production=process.env.NODE_ENV==='production';
const testLogin=process.env.AW_TEST_LOGIN===undefined?!production:process.env.AW_TEST_LOGIN==='1';
// QA field regions (M0 graybox) follow development login unless set explicitly.
const fieldQa=process.env.AW_FIELD_QA===undefined?testLogin&&!production:process.env.AW_FIELD_QA==='1';
const devCheckpoints=process.env.AW_DEV_CHECKPOINTS===undefined?testLogin&&!production:process.env.AW_DEV_CHECKPOINTS==='1';
const app=createApp(pool,{logger:true,testLogin,production,fieldQa,devCheckpoints,fieldFreeze,hubNumbers,...(process.env.AW_PACING_LAB==='1'&&process.env.AW_ISOLATED==='1'?{pacingLab:{isolated:true as const,reportPath:process.env.AW_PACING_REPORT}}:{}),origins:(process.env.AW_ORIGINS??'http://127.0.0.1:8612,http://127.0.0.1:8611').split(',')});
const dist=process.env.AW_STATIC_ROOT??fileURLToPath(new URL('../../web/dist/',import.meta.url));
if(existsSync(dist))await app.register(serveStatic,{root:dist,prefix:'/'});
let stopping=false;async function stop(){if(stopping)return;stopping=true;warm.stop();await app.close();await pool.end();}
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>void stop());
process.on('message',message=>{if(message==='stop')void stop().then(()=>process.disconnect?.());});
process.on('disconnect',()=>void stop());
await app.listen({host:process.env.AW_HOST??'127.0.0.1',port:Number(process.env.AW_API_PORT??8611)});
