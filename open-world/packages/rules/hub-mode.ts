import {requireHub,type HubState} from './hub-state.ts';
export function setHubModePreference(h:HubState,mode:'manual'|'semi'|'auto'){
 requireHub(['manual','semi','auto'].includes(mode),'HUB_MODE','请选择手动、半自动或全自动。');h.mode=mode;return {mode};
}
// 27 号 R1：全场景默认全自动，旧存的半自动偏好不再生效（满包由调用方降为半自动）。手动没有界面入口，只作为验收脚本固定站位的钩子保留。
export const hubModePreference=(h:HubState)=>h.mode==='manual'?'manual' as const:'auto' as const;
