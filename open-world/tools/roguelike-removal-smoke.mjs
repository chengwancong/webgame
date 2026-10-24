// Real HTTP smoke: curl owns every HTTP request; ws is only the existing dungeon
// connection/heartbeat/input transport. Never opens a browser or edits a database.
// This creates one fresh self-owned qa_ account and follows earned progression.
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {createRequire} from 'node:module';
const options=new Map(),args=process.argv.slice(2);
for(let at=0;at<args.length;at++){const key=args[at],value=args[++at];if(!['--base','--out','--timeout-seconds'].includes(key)||!value||options.has(key))throw Error('Use --base URL --out ABSOLUTE_DIRECTORY [--timeout-seconds 600]');options.set(key,value);}
const base=new URL(options.get('--base')??'https://43-165-179-11.sslip.io');
if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('Base must be an origin with no embedded credentials');
if(base.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('HTTP is only permitted for local isolated tests');
const out=options.get('--out')??`G:/webgame/aw-deploy/roguelike-removal-smoke-${Date.now()}`;
if(!isAbsolute(out))throw Error('Output must be an absolute private artifact directory');
const timeout=Number(options.get('--timeout-seconds')??600)*1000;if(!Number.isSafeInteger(timeout)||timeout<1000||timeout>3_600_000)throw Error('Invalid timeout');
mkdirSync(out,{recursive:false});
const curl=process.platform==='win32'?'C:/Windows/System32/curl.exe':'curl',WebSocket=createRequire(new URL('../package.json',import.meta.url))('ws');
const cookieJar=join(out,'cookies.txt'),privateFile=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2),{mode:0o600});
const responsePath=name=>join(out,name+'.json');let serial=0,lease='',character,active,ws,frame,seq=0,lastRenew=0,lastInputStage=-1;
const checks=[],nodes=[],startedAt=new Date().toISOString();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function request(label,path,body){
 const target=new URL('/api/'+path,base),output=responsePath(label),curlArgs=['--silent','--show-error','--connect-timeout','10','--max-time','30','--cookie',cookieJar,'--cookie-jar',cookieJar,'--output',output,'--write-out','%{http_code}'];
 if(body!==undefined){const input=join(out,'request-'+(++serial)+'.json');writeFileSync(input,JSON.stringify(body),{mode:0o600});curlArgs.push('--header','content-type: application/json','--data-binary','@'+input);}
 curlArgs.push(target.href);
 let status;try{status=Number(execFileSync(curl,curlArgs,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}));}catch{throw Error('curl transport failed for '+label+'; private artifacts retained');}
 const text=readFileSync(output,'utf8');let value;try{value=JSON.parse(text);}catch{throw Error(label+' returned non-JSON HTTP '+status);}
 if(status!==200)throw Error(label+' returned HTTP '+status+' ('+String(value.code??value.error??'unknown')+')');
 checks.push({label,status});return value;
}
function noRetiredFields(value){
 if(Array.isArray(value)){for(const item of value)noRetiredFields(item);return;}
 if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(['augments','augmentRounds','augmentPolicy','augmentExtra','augmentCatalog'].includes(key))throw Error('Retired run field appeared in a live response');noRetiredFields(item);}
}
function cookies(){return readFileSync(cookieJar,'utf8').split(/\r?\n/).map(line=>line.startsWith('#HttpOnly_')?line.slice(10):line).filter(line=>line&&!line.startsWith('#')).map(line=>line.split('\t')).filter(parts=>parts.length===7).map(parts=>parts[5]+'='+parts[6]).join('; ');}
function command(op,extra={}){const result=request('command-'+op,'dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...extra});noRetiredFields(result);if(result.instance)frame=result.instance;if(result.snapshot)character=result.snapshot;return result;}
function current(){character=request('character-latest','character');return character;}
function write(path,body){current();const result=request('write-'+path.replaceAll('/','-'),path,{command_id:randomUUID(),lease_id:lease,revision:character.revision,...body});if(result.snapshot)character=result.snapshot;return result;}
function renew(){if(Date.now()-lastRenew>=15000){request('lease-renew','control/renew',{lease_id:lease});lastRenew=Date.now();}}
function input(action){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'input',input:{seq:++seq,...action}}));}
async function connect(id){
 frame=undefined;seq=0;lastInputStage=-1;const target=new URL('/api/dungeons/'+id+'/live',base);target.protocol=base.protocol==='https:'?'wss:':'ws:';
 let transportError;ws=new WebSocket(target,{headers:{cookie:cookies()}});
 ws.on('message',raw=>{try{const message=JSON.parse(String(raw));if(message.type==='state'){noRetiredFields(message.instance);frame=message.instance;}else if(message.type==='error')transportError='Dungeon WS rejected input';}catch{transportError='Dungeon WS returned invalid state';}});
 ws.on('error',()=>{transportError='Dungeon WS connection failed';});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Dungeon WS open timeout')),10000);ws.once('open',()=>{clearTimeout(timer);resolve();});ws.once('error',()=>{clearTimeout(timer);reject(Error('Dungeon WS open failed'));});});
 ws.send(JSON.stringify({type:'hello',lease_id:lease}));
 const deadline=Date.now()+15000;while(!frame){if(transportError)throw Error(transportError);if(Date.now()>deadline)throw Error('Dungeon hello timeout');await sleep(50);}
 return ()=>{if(transportError)throw Error(transportError);};
}
async function prepareEarnedSkills(){
 current();const existing=[...character.skills],available=(character.skillAccess??[]).filter(skill=>skill.activated&&skill.weaponCompatible!==false).map(skill=>skill.id);
 const selected=[...new Set([...existing,...available])].slice(0,character.skillRecovery?.slots??existing.length);
 if(selected.join('|')!==existing.join('|'))write('skills',{skills:selected});
}
async function runNode(nodeId,secondStageOnly=false){
 const created=command('create',{node_id:nodeId});active=created.instance.id;
 privateFile('active-instance.json',{id:active,nodeId});const checkTransport=await connect(active);
 command('ready',{instance_id:active});const start=command('start',{instance_id:active});
 if(start.instance.stage!==0)throw Error('New dungeon did not begin in the first segment');
 input({kind:'mode',mode:'auto'});const deadline=Date.now()+timeout;let sawPassage=false,lastProgress=Date.now();
 while(Date.now()<deadline){
  checkTransport();renew();
  const result=request('instance-latest','dungeons/'+active+'/result');noRetiredFields(result);frame=result.instance;
  if(frame.stage!==lastInputStage){lastInputStage=frame.stage;input({kind:'mode',mode:'auto'});}
  if(frame.plane?.passageOpen)sawPassage=true;
  // Use only the server's public portal coordinate. Real navigation and clearance
  // remain in World; no teleport, synthetic kill, stage mutation or reward injection.
  const portal=frame.plane?.portal,hero=frame.actors?.find(actor=>actor.id===character.id);
  if(portal&&hero&&(frame.plane.passageOpen||frame.plane.exitOpen)&&Math.hypot(hero.position.x-portal.x,hero.position.y-portal.y)>3){input({kind:'go',x:portal.x,y:portal.y});input({kind:'mode',mode:'auto'});}
  if(secondStageOnly&&frame.stage>=1){nodes.push({nodeId,enteredSecondSegment:true,observedPassageOpen:sawPassage,status:frame.status,stage:frame.stage});command('leave',{instance_id:active});active=undefined;ws.close();return;}
  if(['failed','abandoned','closed'].includes(frame.status))throw Error(nodeId+' ended as '+frame.status+' before the required checkpoint');
  if(frame.status==='success'){
   if(secondStageOnly)throw Error('Dungeon ended without observing a second segment');
   nodes.push({nodeId,status:'success',stage:frame.stage});command('return',{instance_id:active});active=undefined;ws.close();return;
  }
  if(Date.now()-lastProgress>=15000){console.log(JSON.stringify({phase:'live-dungeon',nodeId,stage:frame.stage,status:frame.status}));lastProgress=Date.now();}
  await sleep(1000);
 }
 throw Error(nodeId+' timed out without a required real combat transition');
}
try{
 const health=request('health','health');if(health.auth_mode!=='account-only')throw Error('This smoke requires the development account-only login mode');
 const username='qa_rm_'+Date.now().toString(36)+'_'+randomUUID().slice(0,4);privateFile('account-private.json',{username,createdAt:startedAt});
 request('login','session/login',{username});character=request('character-created','character',{name:'副本推进复测'});lease=request('control','control',{client_id:randomUUID()}).lease_id;lastRenew=Date.now();
 privateFile('owner.json',{username,characterId:character.id,createdAt:startedAt,ownershipSource:'roguelike-removal-smoke-v1: fresh account created by this invocation'});
 // Existing legal prologue commands, not a custom skip/kill/high-stat endpoint.
 if(!character.starsea?.prologue?.done){write('prologue',{weapon:'sword'});write('prologue',{finish:true});}
 current();if(character.starsea?.location?.map!=='ss-map-port')throw Error('Legal prologue did not arrive at the port');
 request('mode-preference','control/mode-preference',{command_id:randomUUID(),mode:'auto'});
 const catalogue=request('dungeon-catalogue','dungeons/catalog');noRetiredFields(catalogue);
 await runNode('wind-story-1');await prepareEarnedSkills();
 const chart=request('chart','hub/chart'),nest=chart.regions?.flatMap(region=>region.nodes).find(node=>node.id==='wind-nest-1');
 if(!nest||!['open','cleared'].includes(nest.status))throw Error('First clear did not unlock wind-nest-1 through normal progression');
 await runNode('wind-nest-1',true);
 const summary={ok:true,versions:health.versions,startedAt,finishedAt:new Date().toISOString(),nodes,httpChecks:checks.length,retiredFieldsAbsent:true,transport:'curl HTTP + native WS only',directDatabaseWrites:false};
 privateFile('summary.json',summary);console.log(JSON.stringify(summary));
}catch(error){
 const summary={ok:false,startedAt,finishedAt:new Date().toISOString(),nodes,error:error instanceof Error?error.message:'unknown smoke failure',activeInstanceNeedsExit:Boolean(active)};
 privateFile('summary.json',summary);console.error(JSON.stringify(summary));process.exitCode=1;
}finally{
 if(active&&lease){try{command('leave',{instance_id:active});active=undefined;}catch{/* Keep the private active-instance record for scoped cleanup. */}}
 ws?.close();
}
