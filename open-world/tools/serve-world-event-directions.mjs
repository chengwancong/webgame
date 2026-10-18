import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.'),routes=new Map([['/',['.design/open-world-m2-m4-events/directions.html','text/html; charset=utf-8']],['/review/horde-real-combat.png',['docs/reviews/open-world-m2-m4/W2/visible/horde-real-combat.png','image/png']],['/art/NotoSansSC.ttf',['apps/web/public/art/NotoSansSC.ttf','font/ttf']]]);
const server=createServer(async(req,res)=>{if(req.method==='POST'&&req.url==='/stop'){res.end('Stopping');server.close();return;}const file=routes.get(req.url??'');if(!file){res.writeHead(404);res.end();return;}try{res.writeHead(200,{'Content-Type':file[1]});res.end(await readFile(resolve(root,file[0])));}catch(error){res.writeHead(500);res.end(String(error));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));console.log('http://127.0.0.1:'+server.address().port+'/');
