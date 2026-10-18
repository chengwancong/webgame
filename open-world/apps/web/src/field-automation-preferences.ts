import type {World} from '../../../packages/simulation/index.ts';
export type AutomationPreferences=Pick<World,'radius'|'targetPriority'|'avoidElite'|'autoSkills'>;
/** User/device preferences stay separate from server encounter parameters. */
export class FieldAutomationPreferences{
 private current:AutomationPreferences;
 constructor(defaults:AutomationPreferences){this.current={radius:defaults.radius,targetPriority:defaults.targetPriority,avoidElite:defaults.avoidElite,autoSkills:defaults.autoSkills};}
 get value():AutomationPreferences{return {...this.current};}
 load(saved:Record<string,unknown>){if(typeof saved.radius==='number'&&Number.isFinite(saved.radius))this.current.radius=Math.round(Math.max(3,Math.min(20,saved.radius)));if(saved.targetPriority==='near'||saved.targetPriority==='ranged')this.current.targetPriority=saved.targetPriority;if(typeof saved.avoidElite==='boolean')this.current.avoidElite=saved.avoidElite;if(typeof saved.autoSkills==='boolean')this.current.autoSkills=saved.autoSkills;}
 setRadius(radius:number){if(!Number.isFinite(radius)||!Number.isInteger(radius)||radius<3||radius>20)return false;this.current.radius=radius;return true;}
 update(value:Partial<Omit<AutomationPreferences,'radius'>>){Object.assign(this.current,value);}
 apply(world:AutomationPreferences){Object.assign(world,this.current);}
}
