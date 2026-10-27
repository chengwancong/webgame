import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {World} from '../packages/simulation/index.ts';
import type {Region} from '../packages/content/index.ts';

// Extract production methods rather than constructing the browser application or
// Phaser scene. These tests verify input/presentation wiring, not browser timing.
function method(file:string,className:string,name:string){
 const source=ts.createSourceFile(file,readFileSync(new URL(file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
 const klass=source.statements.find((node):node is ts.ClassDeclaration=>ts.isClassDeclaration(node)&&node.name?.text===className);
 const member=klass?.members.find((node):node is ts.MethodDeclaration=>ts.isMethodDeclaration(node)&&node.name.getText(source)===name);
 if(!member?.body)throw Error(`${className}.${name} not found`);
 return{source,member};
}
function constructorFrom(text:string){
 const js=ts.transpileModule(`class Harness {${text}}\nreturn Harness;`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return new Function(js)() as new()=>any;
}
const movement=method('../apps/web/src/main.ts','GameApp','movementInput');
const interpolation=method('../apps/web/src/scene.ts','WorldScene','interpolate');
const update=method('../apps/web/src/scene.ts','WorldScene','update');
const MovementHarness=constructorFrom(movement.member.getText(movement.source));
const InterpolationHarness=constructorFrom(interpolation.member.getText(interpolation.source));
const updateStatements=update.member.body!.statements;
const clearPose=updateStatements.find(node=>ts.isExpressionStatement(node)&&ts.isBinaryExpression(node.expression)
 &&node.expression.operatorToken.kind===ts.SyntaxKind.EqualsToken
 &&node.expression.left.getText(update.source)==='this.heroPresentation'
 &&node.expression.right.getText(update.source)==='undefined');
if(!clearPose)throw Error('WorldScene.update must clear the frame presentation cache');
const clearFrame=new Function(clearPose.getText(update.source));
let inputBlock:ts.Block|undefined;
function findInput(node:ts.Node){
 if(ts.isBlock(node)&&node.statements.some(statement=>ts.isExpressionStatement(statement)&&ts.isCallExpression(statement.expression)
  &&statement.expression.expression.getText(update.source)==='this.localPrediction.setInput'))inputBlock=node;
 ts.forEachChild(node,findInput);
}
findInput(update.member);
if(!inputBlock)throw Error('Scene input block not found');
const inputCode=ts.transpileModule(inputBlock.getText(update.source),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const sceneInput=new Function('inputBlocked','document',inputCode);

function movementHost(keys:string[]=[]){
 return Object.assign(new MovementHarness(),{panel:'',hidden:false,loggedIn:true,pressed:new Set(keys),bindings:{up:'KeyI',left:'KeyJ',down:'KeyK',right:'KeyL'}});
}
function interpolationHost(){
 const region={id:'test'},world={stats:{speed:10},movementSpeed:vi.fn(()=>4),rules:{bodyCollision:{heroRadius:.55}},region};
 const host=Object.assign(new InterpolationHarness(),{bridge:{authoritativeWorld:true,world},renderNow:1000,heroPresentation:undefined,
  previous:new Map(),accumulator:0,networkMotion:{position:vi.fn(()=>({x:8,y:4}))},localPrediction:{position:vi.fn(()=>({x:8.5,y:4}))}});
 return{host,world,region};
}

describe('actual movement input sent to simulation and presentation',()=>{
 it.each([
  ['KeyI',-1,-1],['KeyJ',-1,1],['KeyK',1,1],['KeyL',1,-1],
  ['ArrowUp',-1,-1],['ArrowLeft',-1,1],['ArrowDown',1,1],['ArrowRight',1,-1],
 ])('uses rebound and arrow key %s', (key,x,y)=>{
  expect(movementHost([key as string]).movementInput()).toEqual({x,y});
 });
 it('does not keep WASD active after rebinding or count a bound key and its arrow twice',()=>{
  expect(movementHost(['KeyW','KeyA','KeyS','KeyD']).movementInput()).toEqual({x:0,y:0});
  expect(movementHost(['KeyL','ArrowRight']).movementInput()).toEqual({x:1,y:-1});
  expect(movementHost(['KeyI','KeyK','KeyJ','KeyL']).movementInput()).toEqual({x:0,y:0});
 });
 it.each([{panel:'bag'},{hidden:true},{loggedIn:false}])('returns zero when focus or session gate is closed: %j',gate=>{
  const host=Object.assign(movementHost(['KeyL']),gate);expect(host.movementInput()).toEqual({x:0,y:0});
 });
 it('passes the actual rebound movement through the scene instead of its fallback WASD state',()=>{
  const app=movementHost(['KeyI']),read=vi.fn(()=>app.movementInput()),setInput=vi.fn();
  const scene={bridge:{movementInput:read},keys:{D:{isDown:true}},localPrediction:{setInput}};
  sceneInput.call(scene,false,{hidden:false});
  expect(read).toHaveBeenCalledTimes(1);expect(setInput).toHaveBeenCalledTimes(1);
  expect(setInput.mock.calls[0][0]).toBeCloseTo(-1/Math.SQRT2);expect(setInput.mock.calls[0][1]).toBeCloseTo(-1/Math.SQRT2);
 });
 it('does not predict movement when scene focus or document visibility blocks input',()=>{
  const scene={bridge:{movementInput:()=>({x:1,y:1})},keys:{},localPrediction:{setInput:vi.fn()}};
  sceneInput.call(scene,true,{hidden:false});sceneInput.call(scene,false,{hidden:true});
  expect(scene.localPrediction.setInput.mock.calls).toEqual([[0,0],[0,0]]);
 });
});

describe('actual scene hero presentation cache',()=>{
 it('uses one prediction and effective speed for both camera and actor reads in a frame',()=>{
  const {host,world,region}=interpolationHost(),server={x:7,y:4};
  const camera=host.interpolate('hero',server),sprite=host.interpolate('hero',server);
  expect(sprite).toBe(camera);expect(host.localPrediction.position).toHaveBeenCalledTimes(1);expect(world.movementSpeed).toHaveBeenCalledTimes(1);
  expect(host.localPrediction.position).toHaveBeenCalledWith(4,region,1000,{x:8,y:4},world.rules.bodyCollision.heroRadius);
 });
 it('clears the cached pose before rendering and recomputes on the next frame',()=>{
  const {host}=interpolationHost(),first=host.interpolate('hero',{x:7,y:4});
  clearFrame.call(host);expect(host.heroPresentation).toBeUndefined();
  host.renderNow=1016;host.localPrediction.position.mockReturnValue({x:9,y:4});
  const next=host.interpolate('hero',{x:8,y:4});
  expect(next).not.toBe(first);expect(next).toEqual({x:9,y:4});expect(host.localPrediction.position).toHaveBeenCalledTimes(2);
  const text=update.member.getText(update.source);
  expect(clearPose!.getStart(update.source)).toBeLessThan(update.member.getStart(update.source)+text.indexOf("this.interpolate('hero'"));
 });
 it('keeps other actors on buffered interpolation without using the hero cache or prediction',()=>{
  const {host,world}=interpolationHost();host.heroPresentation={x:99,y:99};
  const target={x:2,y:3},buffered={x:2.5,y:3};host.networkMotion.position.mockReturnValue(buffered);
  expect(host.interpolate('monster:1',target)).toBe(buffered);
  expect(host.networkMotion.position).toHaveBeenCalledWith('monster:1',target,1000);
  expect(host.localPrediction.position).not.toHaveBeenCalled();expect(world.movementSpeed).not.toHaveBeenCalled();
 });
 it('retains local fixed-tick interpolation without network prediction',()=>{
  const {host}=interpolationHost();host.bridge.authoritativeWorld=false;host.previous.set('hero',{x:4,y:6});host.accumulator=(1000/30)/2;
  expect(host.interpolate('hero',{x:6,y:8})).toEqual({x:5,y:7});
  expect(host.localPrediction.position).not.toHaveBeenCalled();expect(host.networkMotion.position).not.toHaveBeenCalled();
 });
});

describe('presentation consumes the actual simulation walking speed',()=>{
 it.each(['plain','legacy-slow','status-slow','speed-up-and-slow'] as const)('matches six real movement ticks with %s',state=>{
  const region:Region={id:'movement-speed-test',name:'平地测试',subtitle:'',theme:'meadow',boss:false,auto:false,width:40,height:40,safe:{x:10,y:10},portal:{x:15,y:15},landmarks:[],obstacles:[],spawns:[],rest:true};
  const world=new World(region,{hp:100,attack:10,armor:0,speed:6,mana:100,regen:0,effects:[]},[],[]);
  world.setMode('manual');
  if(state==='legacy-slow')world.heroSlowUntil=120;
  if(state==='status-slow'||state==='speed-up-and-slow'){
   world.heroSlowUntil=120;
   world.applyStatus(world.playerId,{kind:'slow',duration:120,strength:.35,scope:'self',cleanse:true});
  }
  if(state==='speed-up-and-slow')world.applyStatus(world.playerId,{kind:'speed_up',duration:120,strength:.25,scope:'self',cleanse:true});
  const speed=world.movementSpeed(),before={...world.hero.position};world.control(1,0);
  for(let i=0;i<6;i++)world.step();
  expect(world.tick).toBe(6);expect(world.hero.position.x-before.x).toBeCloseTo(speed*6/30,8);expect(world.hero.position.y).toBe(before.y);
 });
});
