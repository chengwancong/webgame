import {createServer} from 'vite';
import {startDatabase,child,stopChild,waitFor,registerApi,root} from './runtime.mjs';
import {resolve,sep} from 'node:path';
const database=await startDatabase({temporary:true});let api,web,closing;
function close(){return closing??=(async()=>{await web?.close();await stopChild(api);if(!resolve(database.work).startsWith(resolve(root,'.qa')+sep))throw Error('QA cleanup escaped workspace');console.log('Story review cleanup:',await database.stop());process.stdin.pause();})();}
async function launchApi(){api=child(process.execPath,['--import','tsx','apps/api/src/main.ts'],{AW_DATABASE_URL:database.dsn,AW_API_PORT:'8616',AW_ORIGINS:'http://localhost:5175,http://localhost:8616',AW_TEST_LOGIN:'1'},{stdio:['ignore','ignore','inherit','ipc']});await registerApi(database,api);await waitFor('http://127.0.0.1:8616/api/health',api);}
try{await launchApi();
 web=await createServer({configFile:'apps/web/vite.config.ts',server:{host:'127.0.0.1',port:5175,strictPort:true,hmr:false,proxy:{'/api':{target:'http://127.0.0.1:8616',ws:true}}}});await web.listen();console.log('Story review: http://localhost:5175/');console.log('Write r to reload source while keeping the test database; q to stop and clean up.');
 let reloading=false;await new Promise(resolve=>{process.stdin.resume();process.stdin.on('data',async data=>{const op=String(data).trim();if(op==='q'&&!reloading)resolve();if(op==='r'&&!reloading){reloading=true;try{await stopChild(api);await launchApi();await web.restart();console.log('Story source reloaded; test checkpoint retained.');}catch(error){console.error(error);}finally{reloading=false;}}});});
}finally{await close();}
