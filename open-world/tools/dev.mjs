import {startDatabase,child,stopChild,waitFor,registerApi} from './runtime.mjs';
import {recoverDevelopmentPid} from './dev-recovery.mjs';
await recoverDevelopmentPid();
const database=await startDatabase();let api,web,closePromise,stopping=false;
function close(){stopping=true;return closePromise??= (async()=>{await stopChild(web);await stopChild(api);console.log('Database lifecycle:',await database.stop());})();}
const exitOf=p=>p.exitCode!==null||p.signalCode!==null?Promise.resolve():new Promise(r=>p.once('exit',r));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void close());
process.on('message',message=>{if(message==='stop')void close();});
process.on('disconnect',()=>void close());
try{
 api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:database.dsn,AW_TEST_LOGIN:process.env.AW_TEST_LOGIN??'1'},{stdio:['inherit','inherit','inherit','ipc']});
 await registerApi(database,api);
 await waitFor('http://127.0.0.1:8611/api/health',api);
 if(stopping)throw Error('Development service is stopping');
 web=child(process.execPath,['node_modules/vite/bin/vite.js','--config','apps/web/vite.config.ts']);await waitFor('http://127.0.0.1:8612/',web);
 await registerApi(database,web,'web');
 console.log('\n游戏：http://127.0.0.1:8612/\n数据库仅用于新版，开发数据保存在 .runtime/dev/data，Ctrl-C 停止服务但保留成长。\n');
 await Promise.race([exitOf(api),exitOf(web),...(database.process?[exitOf(database.process)]:[])]);
}catch(e){console.error(e);process.exitCode=1;}finally{await close();if(process.connected)process.disconnect();}
