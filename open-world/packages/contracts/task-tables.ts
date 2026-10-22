import {z} from 'zod';
// 配置表（config/json，由 config/excel 导出）的行格式。字段含义见各工作簿第 1 行批注。
const id=z.string().min(1).max(120),text=z.string().min(1),row=z.number().int().positive(),nn=z.number().int().nonnegative(),pos=z.number().int().positive();
const ids=z.array(id).default([]),coord=z.number().finite();
const wave=z.object({art:id,count:pos,elite:z.boolean().optional()}).strict();
export const featureIds=['forge','professions','grid','summons','aspects','nightmare','trial','high','raid','sprint','waypoint','outpost','events','bounty','field-dungeon'] as const;
export const taskTypeRowSchema=z.object({_row:row,id,name:text,order:nn,enabled:z.boolean(),historical_only:z.boolean().optional(),tone:z.enum(['gold','violet','teal','neutral']),icon:z.enum(['banner','portal','feather','diamond'])}).strict();
export const taskRowSchema=z.object({
 _row:row,id,campaign:z.enum(['starsea','homeward','general']),chapter:id.optional(),order:pos,type:id,title:text,goal:text,kind:z.string().optional(),
 giver:id.optional(),pre:id.optional(),accept_mode:z.enum(['talk','step','arrive','none','discover','board']).default('none'),
 series:id.optional(),thread:z.enum(['A','B','C','arrive','converge','return']).optional(),key_thread:z.boolean().default(false),discover_landmark:id.optional(),zone:id.optional(),abandonable:z.boolean().optional(),auto_track:z.boolean().default(false),repeat_cooldown_seconds:pos.optional(),pool:id.optional(),reward_xp_hardmode:nn.optional(),
 accept_npc:id.optional(),accept_map:id.optional(),accept_landmark:id.optional(),accept_stay:z.boolean().default(false),
 dialog_accept:id.optional(),dialog_progress:id.optional(),dialog_complete:id.optional(),elite:z.boolean().default(false),
 reward_xp:nn.optional(),reward_gold:nn.optional(),reward_material:nn.optional(),journal:z.boolean().default(false),show_when:id.optional(),
 cond_kind:z.enum(['kills','boss','story']).optional(),cond_value:id.optional(),cond_count:pos.optional(),
 summary:text.optional(),story:text.optional(),region:id.optional(),area:text.optional(),place:text.optional(),tags:z.array(text).default([]),
 note:text.optional(),note_ready:text.optional(),goal_ready:text.optional(),goal_final:text.optional(),
 frozen:z.boolean().optional(),hub_node:id.optional(),hub_return:z.boolean().optional(),hub_commission:z.boolean().optional(),reward_materials:z.record(id,nn).optional()
}).strict();
export const stepOps=['talk','interact','battle','defend','choose','route_battle','boss','rescue','gate','clear_camp','reach_waypoint','discover_zone','open_chest','complete_event','kill_rare','clear_dungeon','kill_zone','obtain_hex','equip_hex','hub_fact'] as const;
export const stepRowSchema=z.object({
 _row:row,task:id,seq:pos,op:z.enum(stepOps),key:id,title:text.optional(),label:text,hint:text.optional(),map:id.optional(),landmark:id.optional(),
 point_index:nn.default(0),point_count:pos.default(1),npc:id.optional(),prop:id.optional(),count:nn.default(0),enemies:ids,waves:z.array(wave).optional(),
 seconds:pos.optional(),xp:nn.default(0),speaker:text.optional(),line:text.optional(),defense:id.optional(),then_battle:z.boolean().default(false),
 spawn_at:z.enum(['clue','ally']).optional(),ally_locked:z.boolean().default(false)
 ,world_fact:z.boolean().default(false),zone:id.optional(),camp:id.optional(),gate:id.optional(),
 encounter_hp:pos.optional(),encounter_attack:nn.optional()
}).strict().refine(v=>(v.encounter_hp===undefined&&v.encounter_attack===undefined)||v.op==='battle','Encounter overrides require a battle step');
export const routeRowSchema=z.object({_row:row,task:id,slot:id,id,name:text,landmark:id.optional(),enemies:ids,goal:text.optional(),risk:text.optional(),description:text.optional(),waves:z.array(wave).optional()}).strict();
export const chapterRowSchema=z.object({
 _row:row,id,campaign:z.enum(['starsea','homeward']),order:pos,title:text,map:id,island:text.optional(),boss:id,boss_map:id.optional(),giver:id,ally:id,
 level:pos.optional(),feature:z.enum(featureIds).optional(),feature_text:text.optional(),reveal:text.optional(),choice_after:text.optional(),skills:ids,
 unlock_npc:id.optional(),unlock_features:z.array(z.enum(featureIds)).default([]),unlock_message:text.optional(),
 boss_speaker:text.optional(),boss_line:text.optional(),ready_objective:text.optional(),ready_speaker:text.optional(),ready_line:text.optional()
}).strict();
export const featureRowSchema=z.object({_row:row,id:z.enum(featureIds),name:text,event:id,reason:text,starsea_reason:text}).strict();
export const defenseRowSchema=z.object({_row:row,id,hp:pos,radius:z.number().positive(),hold_ticks:nn,hp_multiplier:z.number().positive(),attack_multiplier:z.number().positive(),retry_seconds:nn}).strict();
export const npcRowSchema=z.object({
 _row:row,id,campaign:z.enum(['starsea','homeward']),name:text,short:text,role:text,voice:text.optional(),home_map:id,x:coord,y:coord,initial:z.boolean().default(false),
 appear:id.optional(),when:id.optional(),until:id.optional(),set_id:id.optional(),weapon:z.boolean().default(false),idle:id.optional(),dialog_join_fallback:id.optional(),join_guide_condition:id.optional(),service_label:text.optional(),service_feature:z.enum(featureIds).optional(),
 service_panel:z.enum(['character','forge','starsea-chart','progression','sea-difficulty']).optional()
}).strict();
export const lineRowSchema=z.object({_row:row,group:id,seq:pos,speaker:text,name:text.optional(),text,when:id.optional()}).strict();
export const npcPositionRowSchema=z.object({_row:row,id,npc:id,map:id,landmark:id.optional(),x:coord,y:coord,when:id.optional(),until:id.optional(),priority:nn.optional()}).strict();
export const conditionRowSchema=z.object({_row:row,target:id,group:pos,kind:z.enum(['task','task_active','task_ready','level','island','island_visited','zone','boss','feature','waypoint','gate','npc_met','threads','hardmode','hex_playstyle']),value:text,path:z.enum(['guide','fallback'])}).strict();
export const rumorRowSchema=z.object({_row:row,id,island:id,zone:id,landmark:id,text,source:z.enum(['task','npc','board']),source_id:id}).strict();
/** 技能找回（任务.xlsx「技能找回」）：招牌技找回、选路送招、任务送招、技能槽、法术归岛。见 docs/progression-goal-plan.md §4、§11.3。 */
const family=z.enum(['sword','staff','hidden']);
export const skillRecoveryRowSchema=z.discriminatedUnion('kind',[
 z.object({_row:row,kind:z.literal('recovery'),family,order:z.number().int().min(1).max(4),skill:id,task:id,line:text}).strict(),
 z.object({_row:row,kind:z.literal('route'),family,skill:id,task:id,choice:z.enum(['a','b']),line:text}).strict(),
 z.object({_row:row,kind:z.literal('grant'),family:family.optional(),skill:id,task:id,line:text}).strict(),
 z.object({_row:row,kind:z.literal('swap'),line:text}).strict(),
 z.object({_row:row,kind:z.literal('skill-island'),skill:id,island:id}).strict(),
 z.object({_row:row,kind:z.literal('slot'),task:id.optional(),slots:z.number().int().min(1).max(4),line:text.optional()}).strict(),
 z.object({_row:row,kind:z.literal('spell-island'),island:id,max_level:pos}).strict()]);
export type SkillRecoveryRow=z.infer<typeof skillRecoveryRowSchema>;
export const parameterRowSchema=z.object({_row:row,id,value:z.unknown()}).strict();
export const triggerRowSchema=z.object({_row:row,id,task:id,event:z.enum(['task_start','map_enter','step_start','wave_half']),step:pos.optional(),map:id.optional(),group:id,mode:z.enum(['popup','notice']),once:z.boolean().default(true)}).strict();
export const propRowSchema=z.object({_row:row,id,name:text.optional(),verb:text.optional(),hint_verb:text.optional(),state_idle:id.optional(),state_done:id.optional()}).strict();
const file=<T extends z.ZodRawShape>(shape:T)=>z.object({source:z.string(),...shape}).strict();
export const tasksFileSchema=file({taskTypes:z.array(z.unknown()),tasks:z.array(z.unknown()),steps:z.array(z.unknown()),routes:z.array(z.unknown()),conditions:z.array(conditionRowSchema).default([]),rumors:z.array(rumorRowSchema).default([]),parameters:z.array(parameterRowSchema).default([]),skillRecovery:z.array(skillRecoveryRowSchema).default([])});
export const chaptersFileSchema=file({chapters:z.array(z.unknown()),features:z.array(z.unknown()),defenses:z.array(z.unknown())});
export const npcsFileSchema=file({npcs:z.array(z.unknown()),positions:z.array(npcPositionRowSchema).default([])});
export const dialogueFileSchema=file({lines:z.array(z.unknown()),triggers:z.array(z.unknown())});
export const propsFileSchema=file({props:z.array(z.unknown())});
export type TaskTypeRow=z.infer<typeof taskTypeRowSchema>;
export type TaskRow=z.infer<typeof taskRowSchema>;
export type StepRow=z.infer<typeof stepRowSchema>;
export type RouteRow=z.infer<typeof routeRowSchema>;
export type ChapterRow=z.infer<typeof chapterRowSchema>;
export type FeatureRow=z.infer<typeof featureRowSchema>;
export type DefenseRow=z.infer<typeof defenseRowSchema>;
export type NpcRow=z.infer<typeof npcRowSchema>;
export type LineRow=z.infer<typeof lineRowSchema>;
export type TriggerRow=z.infer<typeof triggerRowSchema>;
export type PropRow=z.infer<typeof propRowSchema>;
export type DialogueLine={speaker:string;text:string};
