import {beforeAll,afterAll,it as vitestIt,expect} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {loadHubOutsideNumbers} from '../apps/api/src/hub-numbers.ts';
import {migrate,transaction} from '../apps/api/src/database.ts';
import {readHubState,saveHubState} from '../apps/api/src/hub-state.ts';
import {newHubState} from '../packages/rules/hub-state.ts';
import {parseHubOutsideNumbers} from '../packages/content/hub-outside-numbers.ts';
import {craftRecipes} from '../packages/content/crafting.ts';
import {craftRecipeKnown} from '../packages/rules/crafting.ts';
import {progressionConfig} from '../packages/content/deep-progression.ts';
import {validateResponse} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('HUB economy API checks require isolated real PostgreSQL.');
const schema='qa_hub_port_economy_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn,max:1}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:2}),app=createApp(pool,{testLogin:true,dungeons:false,hubNumbers:loadHubOutsideNumbers()});
// B4 已落唯一源：缺失产物直接失败，不再允许跳过经济验收。
const numbersFile=new URL('../packages/content/hub-outside-numbers.json',import.meta.url),published=existsSync(numbersFile),it=vitestIt;if(!published)throw Error('B4 outside numbers must exist; economy acceptance cannot skip.');
let numbers:ReturnType<typeof parseHubOutsideNumbers>;
beforeAll(async()=>{
 numbers=parseHubOutsideNumbers(JSON.parse(readFileSync(numbersFile,'utf8')));
 if(!Object.keys(numbers.donationOffers).length||!Object.keys(numbers.recipeOffers).length)throw Error('B4 must publish real donation and recipe offers before this acceptance test.');
 await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();
});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');await owner.end();});
async function actor(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'hub_econ_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=async(path:string,body?:unknown)=>{const r=await app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});if(r.statusCode>=200&&r.statusCode<300)expect(()=>validateResponse(path,r.json()),`${body===undefined?'GET':'POST'} ${path}: ${r.body}`).not.toThrow();return r;};
 const created=await req('character',{name:'港口经济回归'});expect(created.statusCode,created.body).toBe(200);const id=created.json().id;
 const stored=async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 const s=await stored();s.gold=1000000;s.material=100000;s.starsea.prologue={weapon:'sword',done:true};s.starsea.location={map:'ss-map-port',x:16,y:18};s.starsea.islands=['ss-map-wind','ss-map-mist'];s.starsea.quests={};s.progression.recipes=[];
 for(const offer of Object.values(numbers.donationOffers))for(const[id,n]of Object.entries(offer.materials))if(id!=='enhance_stone')s.progression.materials[id]=Math.max(s.progression.materials[id]??0,n*10);
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);
 const h=newHubState();for(const node of ['wind-story-1','wind-gate','mist-story-1'])h.chart.cleared[node]={firstAt:new Date().toISOString(),bestSeconds:60};h.port.rep={forge:2500,shipyard:0,post:0};await transaction(pool,c=>saveHubState(c,id,h));
 const lease=(await req('control',{client_id:randomUUID()})).json().lease_id;
 return {id,req,stored,lease};
}
it('buys a configured original recipe at its published price exactly once',async()=>{
 const a=await actor(),before=await a.stored(),entry=Object.entries(numbers.recipeOffers).find(([id])=>{const recipe=craftRecipes.find(r=>r.id===id);return recipe&&!recipe.output.pattern&&!recipe.output.repair&&!craftRecipeKnown(before,recipe)&&['ss-map-wind','ss-map-mist',null].includes(recipe.island);});expect(entry,'B4 needs a purchasable sample-region recipe').toBeDefined();
 const [recipe,offer]=entry!,body={recipe,command_id:randomUUID()},paid=await a.req('hub/port/recipe',body);expect(paid.statusCode,paid.body).toBe(200);
 const after=await a.stored();expect(before.gold-after.gold).toBe(offer.gold??progressionConfig.costs.recipeLearn.gold);expect(before.material-after.material).toBe(offer.material??progressionConfig.costs.recipeLearn.material);expect(after.progression.recipes.filter((r:string)=>r===recipe)).toHaveLength(1);
 expect((await a.req('hub/port/recipe',body)).json()).toEqual(paid.json());expect(await a.stored()).toEqual(after);const rejected=await a.req('hub/port/recipe',{recipe,command_id:randomUUID()});expect(rejected.statusCode,rejected.body).toBe(409);expect(await a.stored()).toEqual(after);
});
it('routes existing reputation.donate through the configured bundle and commits one cost/one reputation award',async()=>{
 const a=await actor(),[offerId,offer]=Object.entries(numbers.donationOffers)[0],before=await a.stored(),hBefore=await readHubState(pool,a.id);
 const body={command_id:randomUUID(),revision:before.revision,lease_id:a.lease,action:{op:'reputation.donate',target:'forge',value:offerId}},paid=await a.req('progression/action',body);expect(paid.statusCode,paid.body).toBe(200);
 const after=await a.stored(),hAfter=await readHubState(pool,a.id);expect(hAfter.port.rep.forge-hBefore.port.rep.forge).toBe(offer.rep);
 for(const[id,n]of Object.entries(offer.materials))expect((id==='enhance_stone'?before.material:before.progression.materials[id])-(id==='enhance_stone'?after.material:after.progression.materials[id])).toBe(n);
 expect((await a.req('progression/action',body)).json()).toEqual(paid.json());expect(await a.stored()).toEqual(after);expect(await readHubState(pool,a.id)).toEqual(hAfter);
});
it('rejects insufficient donation material without modifying wallet, reputation or claim history',async()=>{
 const a=await actor(),[offerId,offer]=Object.entries(numbers.donationOffers)[0],s=await a.stored();for(const id of Object.keys(offer.materials)){if(id==='enhance_stone')s.material=0;else s.progression.materials[id]=0;}await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,a.id]);
 const before=await a.stored(),hBefore=await readHubState(pool,a.id),r=await a.req('progression/action',{command_id:randomUUID(),revision:before.revision,lease_id:a.lease,action:{op:'reputation.donate',target:'forge',value:offerId}});expect(r.statusCode,r.body).toBe(409);expect(r.json().message).toContain('材料不足');expect(await a.stored()).toEqual(before);expect(await readHubState(pool,a.id)).toEqual(hBefore);
});
