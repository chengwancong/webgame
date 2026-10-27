import {describe,expect,it} from 'vitest';
import {backgroundArrivalWrite} from '../apps/web/src/write-pause-policy.ts';

describe('background arrival pause policy',()=>{
 it('allows only safe-map arrival observations without a combat permit',()=>{
  for(const region of [{id:'town'},{id:'ss-map-port'},{id:'rest-stop',rest:true}])
   expect(backgroundArrivalWrite('quest',{op:'arrive'},false,region,false)).toBe(true);
 });
 it('keeps a permit-bearing visit paused, including one sent from a safe map',()=>{
  for(const region of [{id:'town'},{id:'ss-map-port'},{id:'rest-stop',rest:true},{id:'ss-map-wind'}])
   expect(backgroundArrivalWrite('quest',{op:'arrive'},false,region,true)).toBe(false);
 });
 it('keeps ordinary field and unknown-map arrivals paused even without a permit',()=>{
  for(const region of [{id:'ss-map-wind'},{id:'unknown'},{id:'rest-stop',rest:false}])
   expect(backgroundArrivalWrite('quest',{op:'arrive'},false,region,false)).toBe(false);
 });
 it('never releases a build-changing request',()=>{
  expect(backgroundArrivalWrite('quest',{op:'arrive'},true,{id:'ss-map-port'},false)).toBe(false);
 });
 it('does not turn other quest actions or malformed bodies into observations',()=>{
  for(const body of [{op:'start'},{op:'interact'},{op:'waypoint'},{op:'Arrive'},{op:1},{},[],null,Object.create({op:'arrive'})])
   expect(backgroundArrivalWrite('quest',body as object,false,{id:'ss-map-port'},false)).toBe(false);
 });
 it('keeps pickup, upgrades, travel, recovery and similarly named routes paused',()=>{
  for(const path of ['reward/claim-many','gear/enhance','slot/upgrade','travel/waypoint','permit','safe','recover','quest/arrive','/quest'])
   expect(backgroundArrivalWrite(path,{op:'arrive'},false,{id:'ss-map-port'},false)).toBe(false);
 });
});
