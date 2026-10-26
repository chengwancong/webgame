import {fieldHtml,panelHeaderHtml} from './ui/primitives.ts';
import {rangeFieldHtml,selectFieldHtml,toggleHtml} from './ui/form-controls.ts';
import {hudMenuIcon} from './hud-icons.ts';

type QaCase={id:string;label:string;render:()=>string;mount?:(root:HTMLElement)=>void|(()=>void)};
const options=[{value:'new',label:'最近获得'},{value:'quality',label:'品质优先'},{value:'name',label:'名称排序'}];
const rangeMount=(root:HTMLElement)=>{
 const input=(event:Event)=>{const slider=event.target as HTMLInputElement;if(slider.type!=='range')return;const output=slider.closest('.ui-range')?.querySelector('output');if(output)output.textContent=slider.id.includes('volume')?`${Math.round(Number(slider.value)*100)}%`:slider.value;};
 root.addEventListener('input',input);return()=>root.removeEventListener('input',input);
};

export const svgFormsQaCases:QaCase[]=[
 {id:'svg-complete-forms',label:'SVG · 表单与选择',render:()=>`<section class="qa-primitives">${panelHeaderHtml('表单控件',{emblemHtml:hudMenuIcon('settings')})}${fieldHtml({id:'qa-svg-form-name',label:'方案名称',value:'远行方案',description:'名称与输入仍是原生文本。'})}${selectFieldHtml({id:'qa-svg-form-sort',label:'物品排序',value:'quality',options,description:'下拉框保持原生菜单与键盘选择。'})}${toggleHtml({id:'qa-svg-form-sound',label:'游戏声音',checked:true,description:'可点击标签或按空格切换。'})}${toggleHtml({id:'qa-svg-form-reduced',label:'减少动态效果',checked:false})}${rangeFieldHtml({id:'qa-svg-form-volume',label:'音量',value:.65,min:0,max:1,step:.05,valueLabel:'65%'})}</section>`,mount:rangeMount},
 {id:'svg-complete-forms-states',label:'SVG · 表单状态',render:()=>`<section class="qa-primitives">${panelHeaderHtml('表单边界状态',{emblemHtml:hudMenuIcon('settings')})}${fieldHtml({id:'qa-svg-form-error',label:'方案名称',value:'',error:'请输入名称，长错误信息应留在所属提示区域内，不压住下一项控件。'})}${fieldHtml({id:'qa-svg-form-disabled',label:'当前账号',value:'远行者',disabled:true})}${selectFieldHtml({id:'qa-svg-form-locked',label:'暂不可切换',value:'name',options,disabled:true})}${toggleHtml({id:'qa-svg-form-lock-on',label:'已启用且当前不可修改',checked:true,disabled:true})}${toggleHtml({id:'qa-svg-form-lock-off',label:'未启用且当前不可修改',checked:false,disabled:true})}${rangeFieldHtml({id:'qa-svg-form-min',label:'下界',value:0,min:0,max:100,step:1,valueLabel:'0'})}${rangeFieldHtml({id:'qa-svg-form-max',label:'上界',value:100,min:0,max:100,step:1,valueLabel:'100'})}</section>`,mount:rangeMount},
];
