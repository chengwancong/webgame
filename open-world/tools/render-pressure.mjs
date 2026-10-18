import {chromium} from 'playwright';
export async function renderPressure(url,duration=30000){
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--enable-precise-memory-info']});const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{await page.goto(url+'/stress.html');await page.waitForFunction(()=>window.awPressure?.().tick>30);const samples=[];const end=Date.now()+duration;while(Date.now()<end){await page.waitForTimeout(1000);samples.push(await page.evaluate(()=>window.awPressure()));}
 if(errors.length)throw Error(errors.join('\n'));const p95=Math.max(...samples.slice(5).map(s=>s.metrics.p95));return {duration_ms:duration,mode:'native Chrome window',samples,frame_p95_max_ms:p95,target_ms:20,target_met:p95<=20,limits:['Not two-hour leak acceptance','Dedicated rendering/logic scene; does not measure UI or API','Reference hardware recorded separately']};
 }finally{await browser.close();}
}
