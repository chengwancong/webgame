/**
 * Authored skill motions for the MiniFantasy hero rig (Claude, 2026-10-15).
 * Poses are blocked pose-to-pose in a facing-independent character frame and baked
 * into Spine 4.2 animation JSON at load; Character.json itself is never modified.
 *
 * Character frame: x forward, y up. Limb/blade angles: 0 forward, 90 up, -90 down, 180 back.
 * Angles are interpolated numerically, so 0→360 is a full turn.
 */
type Ease='linear'|'in'|'out'|'inOut'|'outBack'|'outQuart'|'inCubic';
type Vec2=[number,number];
export type MotionPose={
  t:number;ease?:Ease;
  /** pelvis offset [forward, up] */ hip?:Vec2;
  /** spine1 / spine2 / head tilt; positive leans forward */ lean?:number;chest?:number;head?:number;
  /** [upper, fore] arm angles; R is the weapon arm in front, L the arm behind */ armR?:Vec2;armL?:Vec2;
  /** weapon direction held by the right hand; bladeL for the left hand (defaults to following the forearm) */ blade?:number;bladeL?:number;
  /** IK foot target offsets [forward, up]; F = front foot, B = back foot */ footF?:Vec2;footB?:Vec2;
  /** whole-body turns around the vertical axis (2D squash flip) and squash/stretch */ turn?:number;scale?:Vec2;
};
/** impact and pose times sit on the 60fps source grid: playback floors time*60, so off-grid contact frames are never shown. */
export type SkillMotion={name:string;duration:number;impact:number;poses:MotionPose[]};

// Setup-pose constants from Character.json (navy MiniFantasy rig).
const SPINE2=2.9,ARM_R1=154.9,ARM_R2=6.8,ARM_L1=-161.6,ARM_L2=-9.4,HAND_R=62.2,HAND_L=98.35,FPS=60;
/** The left hand's constrained default: transform armL2_LEFTHAND offsets the forearm by 176.43°. */
const GRIP_L=93.57;
/** bladeL is left out so a pose spreading REST lets the left hand follow its forearm. */
export const REST:Required<Omit<MotionPose,'t'|'ease'|'bladeL'>>={hip:[0,0],lean:0,chest:0,head:0,armR:[-67.8,-74.6],armL:[-111.3,-101.9],blade:27.8,footF:[0,0],footB:[0,0],turn:0,scale:[1,1]};

const eases:Record<Ease,(f:number)=>number>={
  linear:f=>f,in:f=>f*f,out:f=>1-(1-f)**2,inOut:f=>f<.5?2*f*f:1-2*(1-f)**2,
  outQuart:f=>1-(1-f)**4,inCubic:f=>f**3,
  outBack:f=>{const c=1.70158,x=f-1;return 1+(c+1)*x**3+c*x**2;},
};
type Full=Required<Omit<MotionPose,'ease'>>&{ease:Ease};
function resolve(poses:MotionPose[]):Full[]{
  let last:Full={t:0,ease:'linear',...structuredClone(REST),bladeL:REST.armL[1]+GRIP_L};const out:Full[]=[];
  // Arms always take the short way round (a back-flung arm returns behind the body, never through the face);
  // blades keep their authored winding so a cut can sweep through the bottom on purpose.
  const near=(v:number,ref:number)=>v+360*Math.round((ref-v)/360);
  for(const pose of poses){
    const prev=last;last={...last,...structuredClone(pose),ease:pose.ease??'inOut'} as Full;
    last.armR=[near(last.armR[0],prev.armR[0]),near(last.armR[1],prev.armR[1])];last.armL=[near(last.armL[0],prev.armL[0]),near(last.armL[1],prev.armL[1])];
    // An unset bladeL holds while the arm holds, and returns to the default grip when the arm is posed (e.g. REST).
    if(pose.bladeL===undefined&&pose.armL!==undefined)last.bladeL=near(last.armL[1]+GRIP_L,prev.bladeL);out.push(last);
  }
  return out;
}
const lerp=(a:number,b:number,f:number)=>a+(b-a)*f;
function sample(full:Full[],time:number):Full{
  if(time<=full[0].t)return full[0];
  for(let i=1;i<full.length;i++){
    const a=full[i-1],b=full[i];if(time>b.t)continue;
    const f=eases[b.ease]((time-a.t)/Math.max(1e-6,b.t-a.t)),mix=(x:number,y:number)=>lerp(x,y,f),pair=(x:Vec2,y:Vec2):Vec2=>[mix(x[0],y[0]),mix(x[1],y[1])];
    return {t:time,ease:b.ease,hip:pair(a.hip,b.hip),lean:mix(a.lean,b.lean),chest:mix(a.chest,b.chest),head:mix(a.head,b.head),
      armR:pair(a.armR,b.armR),armL:pair(a.armL,b.armL),blade:mix(a.blade,b.blade),bladeL:mix(a.bladeL,b.bladeL),footF:pair(a.footF,b.footF),footB:pair(a.footB,b.footB),turn:mix(a.turn,b.turn),scale:pair(a.scale,b.scale)};
  }
  return full[full.length-1];
}
const round=(v:number)=>Math.round(v*100)/100;
/** A side-view turn reads as facing flips, not a card rotating: the body keeps at least 85% width and mirrors
 * in one step at edge-on (2026-10-16: the old |cos| squeeze down to 32% looked like a paper cut-out mid-spin). */
export function turnScale(turn:number){const c=Math.cos(turn*Math.PI*2);return (c<0?-1:1)*(1-.15*(1-Math.abs(c))**2);}

/** Spine 4.2 JSON for one motion: dense 60fps linear keys carry the authored easing exactly. */
export function bakeSkillMotion(motion:SkillMotion,still=false){
  // Reduced motion keeps the pelvis and feet in place: no lunges, hops or leaps, only the upper-body gesture.
  const zero=(p:MotionPose)=>{const q={...p};for(const k of ['hip','footF','footB'] as const)if(q[k])q[k]=[0,0];return q;};
  const full=resolve(still?motion.poses.map(zero):motion.poses);if(full[full.length-1].t<motion.duration)full.push({...full[full.length-1],t:motion.duration});
  const bones:Record<string,Record<string,unknown[]>>={},key=(bone:string,channel:string,frame:Record<string,number|string>)=>((bones[bone]??={})[channel]??=[]).push(frame);
  const frames=Math.round(motion.duration*FPS);
  for(let i=0;i<=frames;i++){
    const time=round(i/FPS),p=sample(full,i/FPS);
    const spine2World=90+p.lean+SPINE2+p.chest,world=(a:number)=>180-a;
    key('pelvis','translate',{time,x:round(-p.hip[0]),y:round(p.hip[1])});
    key('spine1','rotate',{time,value:round(p.lean)});key('spine2','rotate',{time,value:round(p.chest)});key('head','rotate',{time,value:round(p.head)});
    key('armR1','rotate',{time,value:round(world(p.armR[0])-spine2World-ARM_R1)});key('armR2','rotate',{time,value:round(p.armR[0]-p.armR[1]-ARM_R2)});
    key('armL1','rotate',{time,value:round(world(p.armL[0])-spine2World-ARM_L1)});key('armL2','rotate',{time,value:round(p.armL[0]-p.armL[1]-ARM_L2)});
    // Hand rotation is absolute (constraint rotate mix 0); its position still follows the forearm.
    key('RIGHTHAND','rotate',{time,value:round(90-p.blade-HAND_R)});key('LEFTHAND','rotate',{time,value:round(90-p.bladeL-HAND_L)});
    key('target_legR','translate',{time,x:round(-p.footF[0]),y:round(p.footF[1])});key('target_legL','translate',{time,x:round(-p.footB[0]),y:round(p.footB[1])});
    // The mirror is a stepped key, so no rendered frame interpolates through zero width.
    const width=turnScale(p.turn)*p.scale[0],flips=i<frames&&Math.sign(turnScale(sample(full,(i+1)/FPS).turn))!==Math.sign(turnScale(p.turn));
    key('root','scale',{time,x:round(width),y:round(p.scale[1]),...flips?{curve:'stepped'}:{}});
  }
  return {bones,transform:{armR2_RIGHTHAND:[{mixRotate:0,mixScaleX:0,mixShearY:0}],armL2_LEFTHAND:[{mixRotate:0,mixScaleX:0,mixShearY:0}]}};
}

export const skillMotions:SkillMotion[]=[
  // Sword held level the whole spin; the body turn alone sweeps it around.
  {name:'Skill_Whirl',duration:.62,impact:13/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[-3,-6],lean:-6,chest:-6,armR:[-182,-178],blade:-180,armL:[10,25],footF:[7,0],footB:[-7,0]},
    {t:.13,ease:'in',hip:[0,-7],lean:8,chest:2,armR:[-180,-180],blade:-180,armL:[-20,-10],turn:.2},
    // Contact on the half turn: the body is mirrored at full width and the level blade sweeps across the front.
    {t:13/60,ease:'linear',turn:.5},
    {t:.4,ease:'linear',turn:1.5,hip:[0,-7]},
    {t:.47,ease:'out',hip:[4,-9],lean:16,chest:4,armR:[-30,-40],blade:-22,armL:[190,200],footF:[10,0],footB:[-8,0],turn:1.85},
    {t:.62,ease:'inOut',...REST,turn:2},
  ]},
  // Coil the blade at the hip, then a full-extension lunge that sells the release teleport.
  {name:'Skill_DashThrust',duration:.56,impact:6/60,poses:[
    {t:0},
    {t:.07,ease:'out',hip:[-5,-6],lean:-4,chest:-6,armR:[-150,-20],blade:2,armL:[-40,-20],footF:[4,0],footB:[-6,0],scale:[.97,1.02]},
    {t:6/60,ease:'outQuart',hip:[16,-9],lean:24,chest:6,head:-4,armR:[2,0],blade:-2,armL:[195,200],footF:[24,0],footB:[-16,2],scale:[1.08,.94]},
    {t:.26,ease:'out',hip:[17,-10],lean:22,armR:[0,-4],blade:-6,scale:[1,1]},
    {t:.56,ease:'inOut',...REST},
  ]},
  // Overhead cut, then a rising underhand second cut that sweeps through the bottom.
  {name:'Skill_DoubleSlash',duration:.64,impact:8/60,poses:[
    {t:0},
    {t:.09,ease:'out',hip:[-9,0],lean:-10,chest:-14,armR:[76,92],blade:195,armL:[-30,-20],footF:[3,0],footB:[-4,0]},
    {t:8/60,ease:'inCubic',hip:[7,-8],lean:16,chest:6,armR:[-25,-40],blade:-15,armL:[190,200],footF:[12,0],footB:[-8,0],scale:[1.03,.96]},
    {t:.2,ease:'out',armR:[-60,-75],blade:-70,scale:[1,1]},
    {t:.29,ease:'inOut',hip:[2,-7],lean:6,chest:0,armR:[-160,-150],blade:180,armL:[-20,10]},
    {t:.36,ease:'inCubic',hip:[10,-9],lean:20,chest:8,armR:[5,10],blade:370,armL:[200,210],footF:[16,0],footB:[-10,0],scale:[1.03,.96]},
    {t:.44,ease:'out',hip:[10,-10],armR:[20,30],blade:400,scale:[1,1]},
    {t:.64,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // 刀刃风暴: a sustained storm, so two fast level spins with both arms flung out; contact on the first front sweep.
  {name:'Skill_BladeStorm',duration:.66,impact:9/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-3,-6],lean:-8,chest:-8,armR:[-178,-176],blade:-178,armL:[20,30],footF:[7,0],footB:[-7,0]},
    {t:.08,ease:'in',hip:[0,-8],lean:6,armR:[-180,-180],blade:-180,armL:[0,5],turn:.15},
    {t:9/60,ease:'linear',turn:.5},
    {t:.3,ease:'linear',hip:[0,-10],turn:1.5,scale:[1.03,.97]},
    {t:.45,ease:'linear',hip:[0,-8],turn:2.5,scale:[1,1]},
    {t:.52,ease:'out',hip:[4,-8],lean:14,chest:4,armR:[-30,-40],blade:-22,armL:[190,200],footF:[10,0],footB:[-8,0],turn:2.85},
    {t:.66,ease:'inOut',...REST,turn:3},
  ]},
  // Snap to a vertical guard, hold it, then flick a riposte.
  {name:'Skill_Counter',duration:.6,impact:3/60,poses:[
    {t:0},
    {t:3/60,ease:'outBack',hip:[-5,-6],lean:-8,chest:-4,armR:[-30,70],blade:95,armL:[-60,40],footF:[-2,0],footB:[-10,0],scale:[.98,1.02]},
    {t:.2,ease:'inOut',hip:[-5,-7],scale:[1,1]},
    {t:.28,ease:'outQuart',hip:[8,-7],lean:16,chest:4,armR:[0,0],blade:0,armL:[190,200],footF:[10,0],footB:[-8,0]},
    {t:.36,ease:'out',hip:[8,-8]},
    {t:.6,ease:'inOut',...REST},
  ]},
  // Low crouch with the blade trailing behind, then an explosive rising cut into a small hop.
  {name:'Skill_RisingSlash',duration:.6,impact:10/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[-4,-14],lean:22,chest:8,armR:[-140,-150],blade:200,armL:[-30,-10],footF:[8,0],footB:[-10,0],scale:[1.04,.95]},
    {t:10/60,ease:'inCubic',hip:[8,2],lean:-4,chest:-6,armR:[-15,0],blade:370,armL:[180,190],scale:[1,1]},
    {t:.22,ease:'out',hip:[6,10],lean:-10,armR:[70,95],blade:460,armL:[200,215],footF:[8,8],footB:[-6,10],scale:[.96,1.05]},
    {t:.32,ease:'in',hip:[6,-6],lean:6,chest:0,armR:[40,60],blade:440,footF:[8,0],footB:[-8,0],scale:[1.03,.97]},
    {t:.6,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // Three low spins with the blade level, then a rising finish forward-up (hand kept off the face).
  {name:'Skill_VortexSpin',duration:.75,impact:15/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[-3,-8],lean:-8,chest:-8,armR:[-170,-175],blade:-160,armL:[20,30],footF:[8,0],footB:[-8,0]},
    {t:.16,ease:'in',hip:[0,-12],lean:10,chest:2,armR:[-175,-178],blade:-175,armL:[-20,-10],turn:.25},
    {t:15/60,ease:'linear',turn:.5},
    {t:.42,ease:'linear',hip:[0,-12],turn:2.5},
    {t:.48,ease:'out',hip:[2,4],lean:-8,chest:-4,armR:[38,52],blade:78,armL:[150,170],footF:[4,4],footB:[-4,6],scale:[.96,1.05],turn:3},
    {t:.56,ease:'in',hip:[2,-6],lean:4,footF:[6,0],footB:[-6,0],scale:[1.03,.97]},
    {t:.75,ease:'inOut',...REST,turn:3},
  ]},
  // Raise like the source swing (forearm up, blade level behind the head) so the face stays clear.
  {name:'Skill_LeapSlam',duration:.56,impact:10/60,poses:[
    {t:0},
    {t:.05,ease:'out',hip:[0,-8],lean:12,armR:[-120,-130],blade:200,armL:[-60,-50],scale:[1.04,.95]},
    {t:.11,ease:'out',hip:[2,14],lean:-6,chest:-6,armR:[75,100],blade:190,armL:[120,140],footF:[5,17],footB:[-5,21],scale:[.96,1.05]},
    {t:10/60,ease:'inCubic',hip:[6,-12],lean:22,chest:8,armR:[-25,-35],blade:-15,armL:[200,215],footF:[11,0],footB:[-9,0],scale:[1.06,.93]},
    {t:.21,ease:'out',hip:[6,-15],lean:26,armR:[-45,-60],blade:-60,scale:[1.02,.96]},
    {t:.3,ease:'inOut',hip:[6,-13],scale:[1,1]},
    {t:.56,ease:'inOut',...REST},
  ]},
  // Iai draw low behind, then an underhand rising cut that sweeps through the bottom to the front.
  {name:'Skill_ThunderDash',duration:.56,impact:.1,poses:[
    {t:0},
    {t:.07,ease:'out',hip:[-3,-9],lean:20,chest:8,armR:[-100,-130],blade:195,armL:[-20,-40],footF:[8,0],footB:[-10,2]},
    {t:.1,ease:'outQuart',hip:[14,-6],lean:26,chest:6,head:-4,armR:[5,15],blade:370,armL:[200,205],footF:[22,0],footB:[-14,5],scale:[1.08,.95]},
    {t:.24,ease:'out',hip:[16,-7],lean:24,armR:[8,18],blade:372,scale:[1,1]},
    {t:.56,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // Off hand points at the victim during the raise; contact is the level pass, then a heavy follow-through.
  {name:'Skill_Execute',duration:.7,impact:16/60,poses:[
    {t:0},
    {t:.19,ease:'out',hip:[-9,2],lean:-10,chest:-14,head:-3,armR:[76,92],blade:195,armL:[-25,-15],footF:[2,0],footB:[-4,0]},
    {t:.23,ease:'inOut',lean:-12,armR:[80,98],blade:205},
    {t:16/60,ease:'inCubic',hip:[9,-10],lean:20,chest:8,head:0,armR:[-20,-35],blade:-12,armL:[200,210],footF:[14,0],footB:[-10,0],scale:[1.04,.95]},
    {t:.34,ease:'out',hip:[10,-12],lean:24,armR:[-45,-60],blade:-65,scale:[1,1]},
    {t:.42,ease:'inOut',hip:[10,-11]},
    {t:.7,ease:'inOut',...REST},
  ]},

  // ── Hammer / axe: two-handed (left arm trails the right on the shaft like Attack_TwoHand1), slower coils, bigger squash.
  // Low sweeping cleave: weapon drawn back at the hip, swept under and through the front, carried up.
  {name:'Skill_HeavyCleave',duration:.72,impact:14/60,poses:[
    {t:0},
    {t:.15,ease:'out',hip:[-8,-6],lean:-6,chest:-10,armR:[-170,-160],blade:195,armL:[-150,-140],footF:[8,0],footB:[-10,2],scale:[.96,1.03]},
    {t:.19,ease:'inOut',lean:-8,armR:[-175,-168],blade:205},
    {t:14/60,ease:'inCubic',hip:[10,-10],lean:18,chest:8,head:-4,armR:[-10,-5],blade:355,armL:[-32,-10],footF:[16,0],footB:[-12,3],scale:[1.06,.94]},
    {t:.3,ease:'out',hip:[12,-9],lean:16,armR:[12,22],blade:392,armL:[-28,-8],scale:[1,1]},
    {t:.42,ease:'inOut',hip:[11,-9]},
    {t:.72,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // Standing overhead smash: head driven into the ground ahead, deep crouch on contact.
  {name:'Skill_GroundSmash',duration:.74,impact:13/60,poses:[
    {t:0},
    {t:.14,ease:'out',hip:[-9,-3],lean:-11,chest:-16,head:-4,armR:[80,88],blade:150,armL:[25,45],footF:[3,0],footB:[-11,4],scale:[.97,1.04]},
    {t:.18,ease:'inOut',lean:-13,armR:[82,92],blade:160},
    {t:13/60,ease:'inCubic',hip:[8,-16],lean:30,chest:12,head:-8,armR:[-48,-55],blade:-70,armL:[-68,-50],footF:[14,0],footB:[-12,0],scale:[1.08,.92]},
    {t:.27,ease:'out',hip:[8,-18],lean:32,scale:[1.03,.96]},
    {t:.45,ease:'inOut',hip:[8,-15],scale:[1,1]},
    {t:.74,ease:'inOut',...REST},
  ]},
  // One heavy turn with the weapon at full reach behind, unwinding into a low follow-through.
  {name:'Skill_HeavySpin',duration:.66,impact:6/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-3,-8],lean:-6,chest:-6,armR:[-178,-172],blade:-178,armL:[-160,-150],footF:[8,0],footB:[-8,0],scale:[.97,1.03]},
    {t:.08,ease:'in',hip:[0,-10],lean:8,chest:2,turn:.15,scale:[1,1]},
    // Contact on the half turn (full width, weapon across the front), not edge-on.
    {t:6/60,ease:'linear',turn:.5},
    {t:.34,ease:'linear',hip:[0,-11],turn:1},
    {t:.42,ease:'out',hip:[7,-11],lean:18,chest:6,armR:[-40,-30],blade:-15,armL:[-62,-35],footF:[12,0],footB:[-9,0],scale:[1.04,.96]},
    {t:.66,ease:'inOut',...REST,turn:1},
  ]},
  // Reckless two-hand chop from high overhead with a long step in.
  {name:'Skill_HeavyChop',duration:.68,impact:12/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[-10,-2],lean:-12,chest:-16,head:-5,armR:[80,88],blade:130,armL:[28,48],footF:[4,0],footB:[-10,4],scale:[.97,1.04]},
    {t:.16,ease:'inOut',lean:-14,armR:[82,92],blade:142},
    {t:12/60,ease:'inCubic',hip:[14,-10],lean:24,chest:10,head:-6,armR:[-10,-20],blade:-10,armL:[-35,-20],footF:[22,0],footB:[-14,4],scale:[1.07,.93]},
    {t:.26,ease:'out',hip:[15,-14],lean:30,chest:12,armR:[-60,-70],blade:-80,armL:[-82,-62],scale:[1.02,.97]},
    {t:.4,ease:'inOut',hip:[15,-13],scale:[1,1]},
    {t:.68,ease:'inOut',...REST},
  ]},
  // Gather, then chest out with the weapon raised and the off arm flung back; held through the roar.
  {name:'Skill_WarCry',duration:.62,impact:6/60,poses:[
    {t:0},
    {t:.05,ease:'out',hip:[-2,-7],lean:10,chest:6,head:6,armR:[-70,-80],blade:-50,armL:[-120,-110],scale:[1.03,.96]},
    {t:6/60,ease:'outBack',hip:[-4,2],lean:-10,chest:-16,head:-12,armR:[-10,25],blade:100,armL:[-160,-140],footF:[6,0],footB:[-8,0],scale:[1.04,1.04]},
    {t:.36,ease:'inOut',hip:[-4,1],head:-10,scale:[1.02,1.02]},
    {t:.62,ease:'inOut',...REST},
  ]},
  // Crouched clench, then shoulder the weapon and flex upright; reads as a self-buff, unlike WarCry's raised weapon.
  {name:'Skill_PowerUp',duration:.64,impact:4/60,poses:[
    {t:0},
    {t:4/60,ease:'out',hip:[0,-10],lean:14,chest:10,head:8,armR:[-85,-55],blade:-25,armL:[-100,-75],footF:[4,0],footB:[-4,0],scale:[1.06,.93]},
    {t:.2,ease:'outBack',hip:[0,1],lean:-8,chest:-12,head:-10,armR:[-45,65],blade:128,armL:[-145,-50],scale:[1.02,1.05]},
    {t:.4,ease:'inOut',hip:[0,0],scale:[1.01,1.03]},
    {t:.64,ease:'inOut',...REST},
  ]},
  // Short, fast head strike from the shoulder: small arc, no lean-back.
  {name:'Skill_Bash',duration:.5,impact:6/60,poses:[
    {t:0},
    {t:.07,ease:'out',hip:[-4,-2],lean:-4,chest:-6,armR:[20,55],blade:120,armL:[-10,20],footB:[-6,0]},
    {t:6/60,ease:'inCubic',hip:[10,-8],lean:18,chest:6,armR:[-35,-25],blade:-15,armL:[-55,-35],footF:[12,0],footB:[-8,0],scale:[1.05,.95]},
    {t:.16,ease:'out',hip:[10,-9],armR:[-45,-40],blade:-35,scale:[1,1]},
    {t:.25,ease:'inOut',hip:[10,-8]},
    {t:.5,ease:'inOut',...REST},
  ]},
  // Leap with the weapon overhead, land on both feet driving it into the ground.
  {name:'Skill_QuakeSlam',duration:.8,impact:16/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[0,-10],lean:14,chest:4,armR:[-40,-30],blade:50,armL:[-60,-40],footF:[3,0],footB:[-3,0],scale:[1.06,.93]},
    {t:.2,ease:'out',hip:[-2,18],lean:-10,chest:-16,head:-4,armR:[80,90],blade:165,armL:[25,45],footF:[4,20],footB:[-6,24],scale:[.94,1.08]},
    {t:16/60,ease:'inCubic',hip:[6,-18],lean:30,chest:12,head:-8,armR:[-50,-58],blade:-75,armL:[-70,-52],footF:[12,0],footB:[-12,0],scale:[1.1,.9]},
    {t:.32,ease:'out',hip:[6,-20],lean:32,scale:[1.04,.95]},
    {t:.5,ease:'inOut',hip:[6,-17],scale:[1,1]},
    {t:.8,ease:'inOut',...REST},
  ]},

  // ── Physical staff: quarterstaff handling of the caster's own staff (motion only, appearance unchanged).
  // Chambered at the chest, then a straight lunge with the off hand guiding the shaft.
  {name:'Skill_StaffThrust',duration:.48,impact:5/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-5,-3],lean:-4,chest:-4,armR:[-150,-15],blade:5,armL:[-50,-20],footB:[-5,0],scale:[.97,1.02]},
    {t:5/60,ease:'outQuart',hip:[12,-7],lean:18,chest:4,armR:[0,-2],blade:0,armL:[-30,-10],footF:[18,0],footB:[-12,2],scale:[1.06,.95]},
    {t:.2,ease:'out',hip:[12,-8],lean:16,armR:[0,-4],blade:-3,scale:[1,1]},
    {t:.48,ease:'inOut',...REST},
  ]},
  // Crouched low sweep: the staff head travels behind, under and through the front at ankle height.
  {name:'Skill_StaffSweep',duration:.6,impact:9/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[-6,-8],lean:-4,chest:-8,armR:[-160,-150],blade:195,armL:[-40,-20],footF:[8,0],footB:[-10,0],scale:[.97,1.02]},
    {t:9/60,ease:'inCubic',hip:[6,-14],lean:20,chest:8,armR:[-50,-40],blade:340,armL:[190,200],footF:[14,0],footB:[-14,0],scale:[1.06,.93]},
    {t:.24,ease:'out',hip:[8,-14],lean:22,armR:[-20,-10],blade:380,scale:[1.02,.97]},
    {t:.34,ease:'inOut',hip:[8,-13],scale:[1,1]},
    {t:.6,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // Plant the staff head diagonally ahead, ride up over it (the hand height keeps the head on the ground), land leveling it forward.
  {name:'Skill_PoleVault',duration:.56,impact:8/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[4,-7],lean:14,armR:[-40,-30],blade:-36,armL:[-50,-35],footF:[8,0],footB:[-6,0],scale:[1.04,.96]},
    {t:.11,ease:'out',hip:[6,16],lean:-10,chest:-6,armR:[20,40],blade:-58,armL:[0,20],footF:[14,20],footB:[4,26],scale:[.95,1.06]},
    {t:8/60,ease:'inCubic',hip:[10,-10],lean:22,chest:8,armR:[-15,-25],blade:-15,armL:[190,200],footF:[12,0],footB:[-10,0],scale:[1.07,.93]},
    {t:.24,ease:'out',hip:[10,-12],lean:20,scale:[1,1]},
    {t:.56,ease:'inOut',...REST},
  ]},
  // Jab, chamber, a higher jab (the release), chamber, a downward finishing rap.
  {name:'Skill_StaffFlurry',duration:.6,impact:10/60,poses:[
    {t:0},
    {t:.04,ease:'out',hip:[-4,-3],lean:-4,armR:[-150,-15],blade:5,armL:[-50,-20]},
    {t:.08,ease:'outQuart',hip:[8,-6],lean:14,armR:[0,-2],blade:0,armL:[-25,-8],footF:[12,0],footB:[-8,0]},
    {t:.12,ease:'out',hip:[2,-5],lean:4,armR:[-140,-20],blade:10},
    {t:10/60,ease:'outQuart',hip:[10,-6],lean:16,armR:[15,12],blade:15,footF:[14,0]},
    {t:.21,ease:'out',hip:[3,-5],lean:4,armR:[-140,-30],blade:-5},
    {t:.26,ease:'outQuart',hip:[12,-8],lean:20,armR:[-5,-10],blade:-15,armL:[190,200],scale:[1.05,.95]},
    {t:.34,ease:'out',hip:[12,-8],scale:[1,1]},
    {t:.6,ease:'inOut',...REST},
  ]},
  // Rise on the toes with the staff upright, then drive its butt straight down into the ground.
  {name:'Skill_StaffSlam',duration:.75,impact:14/60,poses:[
    {t:0},
    {t:.16,ease:'out',hip:[-4,10],lean:-8,chest:-10,head:-6,armR:[25,40],blade:92,armL:[0,30],footF:[2,6],footB:[-4,8],scale:[.96,1.05]},
    {t:.2,ease:'inOut',hip:[-4,12],armR:[30,45]},
    {t:14/60,ease:'inCubic',hip:[4,-18],lean:26,chest:10,head:-6,armR:[-70,-80],blade:92,armL:[-80,-60],footF:[12,0],footB:[-12,0],scale:[1.08,.92]},
    {t:.28,ease:'out',hip:[4,-20],scale:[1.03,.96]},
    {t:.45,ease:'inOut',hip:[4,-17],scale:[1,1]},
    {t:.75,ease:'inOut',...REST},
  ]},
  // The staff twirls twice in front while the body turns once, finishing level.
  {name:'Skill_StaffSpin',duration:.6,impact:6/60,poses:[
    {t:0},
    {t:.05,ease:'out',hip:[-2,-4],lean:-4,armR:[-20,-10],blade:0,armL:[-40,-20]},
    {t:.08,ease:'in',hip:[0,-8],lean:6,blade:90,turn:.2},
    // Contact on the half turn, staff level across the front.
    {t:6/60,ease:'linear',blade:180,turn:.5},
    {t:.4,ease:'linear',hip:[0,-8],blade:720,turn:1},
    {t:.46,ease:'out',hip:[8,-9],lean:16,armR:[-5,-10],blade:715,armL:[190,200],footF:[10,0],footB:[-8,0],scale:[1.04,.96]},
    {t:.6,ease:'inOut',...REST,blade:REST.blade+720,turn:1},
  ]},

  // ── Bow (from Shoot1): bow arm aims with the bow upright across it (blade = aim + 90), the left hand nocks
  // at the grip, draws to the chest along the aim and flings back on release. Impact = the arrow leaves.
  {name:'Skill_QuickShot',duration:.48,impact:7/60,poses:[
    {t:0},
    {t:.06,ease:'out',lean:-6,chest:3,armR:[0,3],blade:90,armL:[-88,9],footB:[-6,0]},
    {t:.1,ease:'out',hip:[-6,-1],armL:[-108,0],footB:[-12,0]},
    {t:7/60,ease:'outQuart',hip:[-8,-1],head:-4,armR:[-3,0],blade:92,armL:[178,182],scale:[.98,1.02]},
    {t:.22,ease:'out',hip:[-8,-2],armL:[-175,-177],scale:[1,1]},
    {t:.48,ease:'inOut',...REST},
  ]},
  // Deep crouched draw held under tension, then a hard release that rocks the archer back.
  {name:'Skill_ChargedShot',duration:.7,impact:17/60,poses:[
    {t:0},
    {t:.08,ease:'out',hip:[-2,-3],lean:-6,chest:3,armR:[0,3],blade:90,armL:[-88,9]},
    {t:.2,ease:'inOut',hip:[-10,-6],lean:-8,chest:-4,armR:[2,5],blade:88,armL:[-112,-5],footF:[4,0],footB:[-18,0],scale:[1.02,.98]},
    {t:.26,ease:'inOut',hip:[-11,-6],armL:[-114,-8]},
    {t:17/60,ease:'outQuart',hip:[-16,-4],lean:-12,chest:-6,head:-6,armR:[6,10],blade:96,armL:[-178,-175],footF:[-2,0],footB:[-20,0],scale:[.97,1.03]},
    {t:.38,ease:'out',hip:[-15,-4],scale:[1,1]},
    {t:.7,ease:'inOut',...REST},
  ]},
  // Released aimed high, then the bow sweeps down through the fan while the draw hand stays back.
  {name:'Skill_ShotFan',duration:.55,impact:7/60,poses:[
    {t:0},
    {t:.06,ease:'out',lean:-8,chest:-4,armR:[18,22],blade:108,armL:[-70,27],footB:[-6,0]},
    {t:.1,ease:'out',hip:[-6,-1],armL:[-90,15],footB:[-12,0]},
    {t:7/60,ease:'outQuart',hip:[-7,-1],head:-4,armR:[16,20],blade:106,armL:[194,198]},
    {t:.22,ease:'inOut',lean:4,chest:4,armR:[-18,-14],blade:72,armL:[170,175]},
    {t:.3,ease:'out',hip:[-7,-2]},
    {t:.55,ease:'inOut',...REST},
  ]},
  // Lean back and loose high into the sky (aim 60°).
  {name:'Skill_SkyShot',duration:.72,impact:18/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[-4,-3],lean:-10,chest:-12,head:-10,armR:[55,58],blade:145,armL:[-40,45],footF:[4,0],footB:[-8,0]},
    {t:.24,ease:'inOut',hip:[-6,-6],lean:-12,chest:-14,armR:[60,63],blade:150,armL:[-48,62],scale:[1.02,.98]},
    {t:18/60,ease:'outQuart',hip:[-8,-4],head:-12,armR:[62,66],blade:152,armL:[-124,-120],scale:[.98,1.02]},
    {t:.4,ease:'out',hip:[-8,-4],scale:[1,1]},
    {t:.72,ease:'inOut',...REST},
  ]},
  // Drop to a low kneel, a long steady draw, then a minimal release.
  {name:'Skill_Snipe',duration:.8,impact:20/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[-4,-16],lean:6,head:2,armR:[0,3],blade:90,armL:[-88,9],footF:[8,0],footB:[-14,0]},
    {t:.25,ease:'inOut',hip:[-6,-16],armL:[-110,0]},
    {t:.3,ease:'inOut',armL:[-112,-2]},
    {t:20/60,ease:'outQuart',hip:[-8,-16],head:-4,armR:[3,6],blade:93,armL:[178,182]},
    {t:.45,ease:'out',hip:[-8,-16]},
    {t:.8,ease:'inOut',...REST},
  ]},

  // ── Hidden weapons (dual daggers): the back arm carries the left dagger (bladeL); throws keep the dagger in hand
  // and let the projectile effect sell the release.
  // Sidearm throw with the off hand pointing at the target.
  {name:'Skill_Throw',duration:.46,impact:6/60,poses:[
    {t:0},
    {t:.05,ease:'out',hip:[-4,-3],lean:-6,chest:-8,armR:[-170,-140],blade:190,armL:[-30,-10],bladeL:0,footB:[-6,0]},
    {t:6/60,ease:'outQuart',hip:[8,-5],lean:14,chest:6,armR:[5,0],blade:-5,armL:[-150,-130],bladeL:-40,footF:[10,0],footB:[-8,0],scale:[1.04,.97]},
    {t:.2,ease:'out',armR:[-10,-20],blade:-30,scale:[1,1]},
    {t:.46,ease:'inOut',...REST},
  ]},
  // Both blades crossed at the chest, then flung apart high and low.
  {name:'Skill_FanThrow',duration:.5,impact:6/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-3,-4],lean:-4,chest:-6,armR:[-120,-30],blade:150,armL:[-80,-20],bladeL:150,footB:[-4,0],scale:[.98,1.02]},
    {t:6/60,ease:'outQuart',hip:[8,-6],lean:12,armR:[25,25],blade:30,armL:[-30,-30],bladeL:-30,footF:[10,0],footB:[-8,0],scale:[1.04,.97]},
    {t:.2,ease:'out',armR:[30,35],blade:40,armL:[-35,-40],bladeL:-40,scale:[1,1]},
    {t:.5,ease:'inOut',...REST},
  ]},
  // A small, fast wrist flick from the chest; the body barely moves.
  {name:'Skill_Flick',duration:.42,impact:5/60,poses:[
    {t:0},
    {t:.05,ease:'out',hip:[-2,-2],lean:-3,armR:[-110,40],blade:120},
    {t:5/60,ease:'outQuart',hip:[3,-3],lean:6,head:-2,armR:[-20,5],blade:10},
    {t:.18,ease:'out',armR:[-25,-5],blade:-5},
    {t:.42,ease:'inOut',...REST},
  ]},
  // Coil low with both blades behind, then arrive (release teleport) in a low twin-blade lunge.
  {name:'Skill_ShadowStep',duration:.5,impact:3/60,poses:[
    {t:0},
    {t:.03,ease:'out',hip:[0,-12],lean:20,chest:6,armR:[-150,-160],blade:200,armL:[-160,-150],bladeL:200,footF:[6,0],footB:[-8,0],scale:[1.05,.94]},
    {t:3/60,ease:'outQuart',hip:[14,-10],lean:26,armR:[10,0],blade:-10,armL:[190,200],bladeL:170,footF:[20,0],footB:[-14,2],scale:[1.08,.94]},
    {t:.2,ease:'out',hip:[14,-12],scale:[1,1]},
    {t:.5,ease:'inOut',...REST},
  ]},
  // Alternating stabs at varied heights: R high, L low, R (release), L low, R low.
  {name:'Skill_DaggerFlurry',duration:.55,impact:8/60,poses:[
    {t:0},
    {t:.03,ease:'out',hip:[-2,-4],lean:4,armR:[-130,-40],blade:10,armL:[-140,-50],bladeL:5,footF:[4,0],footB:[-6,0]},
    {t:.07,ease:'outQuart',hip:[8,-5],lean:14,armR:[12,8],blade:12,armL:[-140,-55],bladeL:5},
    {t:.1,ease:'out',hip:[9,-6],armR:[-130,-40],blade:10,armL:[-40,-28],bladeL:-22},
    {t:8/60,ease:'outQuart',lean:16,armR:[2,-4],blade:-2,armL:[-140,-55],bladeL:5},
    {t:.18,ease:'out',armR:[-130,-40],blade:10,armL:[-38,-24],bladeL:-18},
    {t:.23,ease:'outQuart',hip:[10,-8],lean:18,armR:[-18,-24],blade:-28,armL:[-140,-60],bladeL:10,scale:[1.04,.97]},
    {t:.3,ease:'out',scale:[1,1]},
    {t:.55,ease:'inOut',...REST},
  ]},
  // Big overhand throw: blade cocked above and behind the head, step and whip it down.
  {name:'Skill_OverhandThrow',duration:.6,impact:12/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[-8,-2],lean:-10,chest:-14,armR:[95,130],blade:170,armL:[-10,10],bladeL:20,footF:[4,0],footB:[-10,2],scale:[.98,1.03]},
    {t:12/60,ease:'outQuart',hip:[10,-8],lean:22,chest:10,head:-4,armR:[-15,-30],blade:-30,armL:[-150,-140],bladeL:-50,footF:[16,0],footB:[-12,2],scale:[1.05,.95]},
    {t:.28,ease:'out',armR:[-40,-55],blade:-55,scale:[1,1]},
    {t:.6,ease:'inOut',...REST},
  ]},
  // Sneak low with both blades chambered at the hips, then a twin thrust and a twist.
  {name:'Skill_Backstab',duration:.72,impact:15/60,poses:[
    {t:0},
    {t:.14,ease:'out',hip:[-6,-14],lean:24,chest:8,head:6,armR:[-150,-60],blade:0,armL:[-160,-70],bladeL:0,footF:[8,0],footB:[-10,0],scale:[1.04,.95]},
    {t:.2,ease:'inOut',hip:[-7,-15]},
    {t:15/60,ease:'outQuart',hip:[16,-8],lean:22,chest:6,head:-4,armR:[8,2],blade:0,armL:[-35,-22],bladeL:-8,footF:[22,0],footB:[-16,2],scale:[1.08,.94]},
    {t:.32,ease:'out',hip:[16,-9],armR:[4,-2],blade:-12,armL:[-40,-28],bladeL:-18,scale:[1,1]},
    {t:.42,ease:'inOut',hip:[16,-9]},
    {t:.72,ease:'inOut',...REST},
  ]},
  // Arms spread (front blade ahead, back blade behind), two airborne turns, crouched landing.
  {name:'Skill_LotusSpin',duration:.68,impact:6/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-2,-8],lean:6,armR:[-20,-10],blade:0,armL:[200,190],bladeL:180,footF:[6,0],footB:[-6,0],scale:[1.04,.96]},
    {t:6/60,ease:'in',hip:[0,4],lean:0,armR:[0,0],blade:0,armL:[180,180],bladeL:180,footF:[4,6],footB:[-4,8],turn:.5,scale:[.97,1.04]},
    {t:.42,ease:'linear',hip:[0,6],turn:2},
    {t:.5,ease:'out',hip:[4,-8],lean:12,armR:[-30,-40],blade:-20,armL:[-150,-130],bladeL:-140,footF:[8,0],footB:[-8,0],scale:[1.04,.96]},
    {t:.68,ease:'inOut',...REST,turn:2},
  ]},
  // Underhand lob: swing back low, through the bottom, release rising.
  {name:'Skill_Lob',duration:.55,impact:10/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[-6,-6],lean:10,armR:[-140,-130],blade:190,armL:[-30,-10],bladeL:0,footB:[-8,0],scale:[1.02,.98]},
    {t:.13,ease:'in',hip:[0,-3],lean:2,armR:[-60,-50],blade:280},
    {t:10/60,ease:'out',hip:[6,2],lean:-8,chest:-6,armR:[50,60],blade:440,armL:[-120,-100],bladeL:-30,footF:[8,0],footB:[-6,2],scale:[.98,1.03]},
    {t:.28,ease:'out',armR:[60,70],blade:450,scale:[1,1]},
    {t:.55,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // An X: the front blade cuts high to low while the back blade rips low to high.
  {name:'Skill_CrossSlash',duration:.48,impact:6/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-4,-2],lean:-6,chest:-8,armR:[60,80],blade:150,armL:[-160,-150],bladeL:200,footB:[-6,0]},
    {t:6/60,ease:'inCubic',hip:[10,-8],lean:18,chest:6,armR:[-40,-55],blade:-60,armL:[25,40],bladeL:60,footF:[12,0],footB:[-8,0],scale:[1.05,.95]},
    {t:.18,ease:'out',armR:[-55,-70],blade:-80,armL:[35,50],bladeL:75,scale:[1,1]},
    {t:.48,ease:'inOut',...REST},
  ]},
  // Hug in small, then burst up with the arms spread (smoke veil).
  {name:'Skill_Vanish',duration:.55,impact:6/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[0,-14],lean:22,chest:10,head:10,armR:[-100,40],blade:150,armL:[-80,50],bladeL:160,scale:[1.05,.92]},
    {t:6/60,ease:'outBack',hip:[0,6],lean:-10,chest:-12,head:-8,armR:[20,30],blade:40,armL:[195,205],bladeL:190,footF:[6,4],footB:[-6,6],scale:[.96,1.06]},
    {t:.3,ease:'out',hip:[0,0],footF:[6,0],footB:[-6,0],scale:[1,1]},
    {t:.55,ease:'inOut',...REST},
  ]},

  // ── Spells (any weapon): the held weapon acts as the focus, the off hand gestures; the off hand stays below the
  // face when it reaches forward.
  // Raise the focus, then point it down at the target spot.
  {name:'Skill_CastGround',duration:.6,impact:14/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[-3,2],lean:-6,chest:-8,head:-6,armR:[40,60],blade:100,armL:[-140,-120],footB:[-6,0],scale:[.98,1.03]},
    {t:14/60,ease:'outQuart',hip:[6,-8],lean:18,chest:6,head:4,armR:[-30,-40],blade:-45,armL:[-150,-130],footF:[10,0],footB:[-8,0],scale:[1.04,.96]},
    {t:.32,ease:'out',hip:[6,-9],scale:[1,1]},
    {t:.6,ease:'inOut',...REST},
  ]},
  // Both hands drawn back, then pushed straight at the target.
  {name:'Skill_CastThrust',duration:.56,impact:10/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[-6,-2],lean:-8,chest:-6,armR:[-150,-20],blade:30,armL:[-150,-60],footB:[-8,0],scale:[.97,1.03]},
    {t:10/60,ease:'outQuart',hip:[10,-5],lean:16,chest:6,armR:[5,5],blade:20,armL:[-40,-20],footF:[14,0],footB:[-10,0],scale:[1.05,.96]},
    {t:.3,ease:'out',hip:[10,-6],scale:[1,1]},
    {t:.56,ease:'inOut',...REST},
  ]},
  // Javelin: focus cocked at the shoulder pointing ahead, off hand aiming, then a long throw-through.
  {name:'Skill_CastLance',duration:.66,impact:16/60,poses:[
    {t:0},
    {t:.16,ease:'out',hip:[-10,-3],lean:-10,chest:-12,armR:[-170,10],blade:5,armL:[-40,-20],footF:[4,0],footB:[-12,2],scale:[.97,1.03]},
    {t:.22,ease:'inOut',hip:[-11,-4]},
    {t:16/60,ease:'outQuart',hip:[12,-6],lean:18,chest:8,armR:[5,2],blade:3,armL:[-150,-140],footF:[18,0],footB:[-14,2],scale:[1.06,.95]},
    {t:.34,ease:'out',scale:[1,1]},
    {t:.66,ease:'inOut',...REST},
  ]},
  // Both arms up to the sky, held, then dragged down to call the strike.
  {name:'Skill_CastSky',duration:.8,impact:25/60,poses:[
    {t:0},
    {t:.2,ease:'out',hip:[-4,4],lean:-12,chest:-16,head:-14,armR:[52,70],blade:100,armL:[-165,-150],footF:[4,2],footB:[-6,4],scale:[.97,1.04]},
    {t:.3,ease:'inOut',hip:[-4,6],head:-16,armR:[56,74],armL:[-160,-145]},
    {t:25/60,ease:'inCubic',hip:[6,-10],lean:20,chest:8,head:4,armR:[-40,-50],blade:-40,armL:[-50,-55],footF:[8,0],footB:[-8,0],scale:[1.06,.94]},
    {t:.5,ease:'out',hip:[6,-11],scale:[1,1]},
    {t:.8,ease:'inOut',...REST},
  ]},
  // Gather between both hands at the chest, then push the charge out.
  {name:'Skill_CastCharge',duration:.6,impact:12/60,poses:[
    {t:0},
    {t:.14,ease:'out',hip:[-6,-4],lean:-4,chest:-2,armR:[-100,30],blade:110,armL:[-90,40],footB:[-6,0],scale:[.97,1.02]},
    {t:12/60,ease:'outQuart',hip:[10,-5],lean:16,armR:[0,5],blade:30,armL:[-20,-5],footF:[12,0],footB:[-10,0],scale:[1.05,.96]},
    {t:.34,ease:'out',scale:[1,1]},
    {t:.6,ease:'inOut',...REST},
  ]},
  // A quick off-hand flick; the weapon hand stays low.
  {name:'Skill_CastFlick',duration:.42,impact:6/60,poses:[
    {t:0},
    {t:.06,ease:'out',hip:[-2,-2],lean:-4,armR:[-75,-60],blade:20,armL:[-120,40]},
    {t:6/60,ease:'outQuart',hip:[4,-3],lean:8,head:-2,armL:[-30,-20]},
    {t:.18,ease:'out',armL:[-35,-30]},
    {t:.42,ease:'inOut',...REST},
  ]},
  // Alternating pushes R (release), L, R.
  {name:'Skill_CastRapid',duration:.58,impact:6/60,poses:[
    {t:0},
    {t:.05,ease:'out',hip:[-3,-2],lean:-4,armR:[-130,10],blade:60,armL:[-120,20]},
    {t:6/60,ease:'outQuart',hip:[5,-3],lean:10,armR:[0,5],blade:30},
    {t:.16,ease:'out',armR:[-120,10],blade:60,armL:[-30,-15]},
    {t:.24,ease:'outQuart',hip:[6,-4],lean:12,armR:[5,8],blade:30,armL:[-120,20]},
    {t:.32,ease:'out',hip:[6,-4]},
    {t:.58,ease:'inOut',...REST},
  ]},
  // Curl in, then burst outward with the arms flung wide.
  {name:'Skill_CastBurst',duration:.56,impact:8/60,poses:[
    {t:0},
    {t:.1,ease:'out',hip:[0,-10],lean:18,chest:10,head:8,armR:[-100,40],blade:140,armL:[-80,50],scale:[1.05,.93]},
    {t:8/60,ease:'outBack',hip:[0,4],lean:-10,chest:-14,head:-10,armR:[20,25],blade:60,armL:[195,205],footF:[6,2],footB:[-6,3],scale:[.96,1.06]},
    {t:.3,ease:'out',hip:[0,1],footF:[6,0],footB:[-6,0],scale:[1,1]},
    {t:.56,ease:'inOut',...REST},
  ]},
  // Reach out with the off hand, clench (release), and yank it back to the chest.
  {name:'Skill_CastGrip',duration:.66,impact:12/60,poses:[
    {t:0},
    {t:.12,ease:'out',hip:[4,-4],lean:10,armR:[-90,-80],blade:30,armL:[-25,-10],footF:[8,0],footB:[-6,0]},
    {t:12/60,ease:'inOut',lean:12,head:-2,armL:[-30,-30],scale:[1.02,.98]},
    {t:.3,ease:'outQuart',hip:[-6,-3],lean:-8,chest:-6,armL:[-150,-40],footF:[4,0],footB:[-10,0],scale:[1,1]},
    {t:.4,ease:'out',hip:[-6,-3]},
    {t:.66,ease:'inOut',...REST},
  ]},
  // The focus traces one full circle in front, then thrusts out of it.
  {name:'Skill_CastSwirl',duration:.66,impact:18/60,poses:[
    {t:0},
    {t:.08,ease:'out',lean:-4,armR:[20,40],blade:60,armL:[-130,-110]},
    {t:.15,ease:'linear',armR:[55,75],blade:150},
    {t:.22,ease:'linear',armR:[10,20],blade:240},
    {t:.27,ease:'linear',armR:[-30,-20],blade:330},
    {t:18/60,ease:'outQuart',hip:[8,-5],lean:14,armR:[0,5],blade:380,armL:[-150,-140],footF:[10,0],footB:[-8,0],scale:[1.04,.96]},
    {t:.4,ease:'out',scale:[1,1]},
    {t:.66,ease:'inOut',...REST,blade:REST.blade+360},
  ]},
  // Brace behind the upright weapon.
  {name:'Skill_Guard',duration:.55,impact:2/60,poses:[
    {t:0},
    {t:2/60,ease:'outBack',hip:[-4,-8],lean:6,chest:4,head:4,armR:[-30,65],blade:95,armL:[-60,40],footF:[4,0],footB:[-10,0],scale:[1.04,.96]},
    {t:.3,ease:'inOut',hip:[-4,-8]},
    {t:.55,ease:'inOut',...REST},
  ]},
  // Hands to the chest with the head bowed, then raised to the sky.
  {name:'Skill_Bless',duration:.7,impact:15/60,poses:[
    {t:0},
    {t:.14,ease:'out',hip:[0,-4],lean:6,head:8,armR:[-80,30],blade:100,armL:[-70,40]},
    {t:15/60,ease:'inOut',hip:[0,4],lean:-8,chest:-12,head:-12,armR:[50,70],blade:100,armL:[-165,-150],footF:[2,3],footB:[-2,4],scale:[.98,1.04]},
    {t:.4,ease:'inOut',hip:[0,3]},
    {t:.7,ease:'inOut',...REST},
  ]},
  // A quick crouch and an energetic hop with the weapon thrust up.
  {name:'Skill_Empower',duration:.5,impact:4/60,poses:[
    {t:0},
    {t:.04,ease:'out',hip:[0,-8],lean:12,armR:[-90,-60],blade:0,armL:[-110,-90],scale:[1.05,.94]},
    {t:4/60,ease:'outBack',hip:[0,8],lean:-6,chest:-8,head:-6,armR:[30,60],blade:90,armL:[-150,-120],footF:[3,6],footB:[-3,8],scale:[.95,1.06]},
    {t:.2,ease:'out',hip:[0,0],footF:[0,0],footB:[0,0],scale:[1.02,.98]},
    {t:.28,ease:'out',scale:[1,1]},
    {t:.5,ease:'inOut',...REST},
  ]},
  // Pinch thin into the teleport and pop back out on arrival.
  {name:'Skill_Blink',duration:.42,impact:2/60,poses:[
    {t:0},
    {t:2/60,ease:'in',hip:[0,-4],lean:6,armR:[-80,-90],armL:[-100,-95],scale:[.6,1.12]},
    {t:.1,ease:'outBack',hip:[0,-6],scale:[1.08,.94]},
    {t:.2,ease:'out',hip:[0,0],scale:[1,1]},
    {t:.42,ease:'inOut',...REST},
  ]},
];

/** Suffix of each motion's in-place variant, played when the player reduces motion. */
export const STILL='@still';
const impacts=new Map(skillMotions.map(m=>[m.name,m.impact]));
/** Release time (s) of an authored motion, mapped onto the simulation's windup end. */
export function skillMotionImpact(name:string){return impacts.get(name);}
/** Adds the authored animations (and their in-place variants) to parsed skeleton JSON before SkeletonJson reads it. */
export function installSkillMotions(json:{animations?:Record<string,unknown>}){
  const animations=json.animations??={};
  for(const motion of skillMotions){animations[motion.name]??=bakeSkillMotion(motion);animations[motion.name+STILL]??=bakeSkillMotion(motion,true);}
  return json;
}
