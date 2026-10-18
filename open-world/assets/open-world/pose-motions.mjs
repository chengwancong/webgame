/** New native timelines on the unchanged weighted rig. No bitmap pose substitution. */
export const poseNames=['point','crouch','sit','wave'];
const keys=(values)=>values.map(([time,value])=>({time,value}));
export function addArtPoses(original){
 const data=structuredClone(original),base=structuredClone(data.animations.Wait1);
 const point=structuredClone(data.animations.Spell1);data.animations.OW_point=point;
 const crouch=structuredClone(base);crouch.bones={...crouch.bones,pelvis:{translate:[{y:-27},{time:1,y:-29},{time:2,y:-27}]},spine1:{rotate:[{value:-10}],translate:[{}]},spine2:{rotate:[{value:16}]},RIGHTHAND:{translate:[{x:5,y:-24}],rotate:[{value:20}]}};data.animations.OW_crouch=crouch;
 const sit=structuredClone(base);sit.bones={...sit.bones,pelvis:{translate:[{y:-46},{time:1,y:-47},{time:2,y:-46}]},spine1:{rotate:[{value:8}],translate:[{}]},spine2:{rotate:[{value:-7}]},target_legL:{translate:[{x:18,y:-4}]},target_legR:{translate:[{x:-12,y:-3}]},RIGHTHAND:{translate:[{x:-4,y:-29}],rotate:[{value:10}]},LEFTHAND:{translate:[{x:0,y:-27}]}};data.animations.OW_sit=sit;
 const wave=structuredClone(data.animations.Cast2);wave.bones.armR1={rotate:[{value:-150}]};wave.bones.armR2={rotate:keys([[0,20],[.25,45],[.5,20],[.75,45],[1,20],[1.25,45],[1.5,20],[1.75,45],[2,20]])};data.animations.OW_wave=wave;
 return data;
}
