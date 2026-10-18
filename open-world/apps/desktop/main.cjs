const {app,BrowserWindow}=require('electron');
const http=require('node:http');const fs=require('node:fs');const path=require('node:path');
const dist=path.resolve(__dirname,'../web/dist');let server;
// The same origin serves LOCAL bundled files and forwards only /api to configured API.
app.whenReady().then(async()=>{
 if(!fs.existsSync(path.join(dist,'index.html')))throw Error('Build the Web client before starting desktop.');
 const upstream=new URL(process.env.AW_DESKTOP_API||'http://127.0.0.1:8611');if(!['http:','https:'].includes(upstream.protocol))throw Error('Unsupported API protocol');
 server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/')){
 const headers={...req.headers};delete headers.host;delete headers.origin;delete headers['sec-fetch-site'];const chunks=[];for await(const c of req)chunks.push(c);
 const response=await fetch(new URL(url.pathname+url.search,upstream),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
 res.statusCode=response.status;for(const [k,v]of response.headers)if(!['content-encoding','transfer-encoding'].includes(k))res.setHeader(k,v);res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 const file=path.resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.ttf':'font/ttf'};res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; script-src 'self'; font-src 'self'");fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
 }catch{res.writeHead(502).end('Connection failed');}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const win=new BrowserWindow({width:1280,height:800,minWidth:900,minHeight:600,title:'深渊行者 · 苍风远行',webPreferences:{contextIsolation:true,sandbox:true,nodeIntegration:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('http://127.0.0.1:'+server.address().port+'/'))event.preventDefault();});
 await win.loadURL('http://127.0.0.1:'+server.address().port+'/');
 if(process.env.AW_DESKTOP_SMOKE==='1')setTimeout(async()=>{console.log('DESKTOP_LOCAL_LOADED',await win.webContents.executeJavaScript('document.title'));await win.webContents.capturePage().then(i=>{if(process.env.AW_DESKTOP_SCREENSHOT)fs.writeFileSync(process.env.AW_DESKTOP_SCREENSHOT,i.toPNG());});app.quit();},4000);
});app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>server?.close());
