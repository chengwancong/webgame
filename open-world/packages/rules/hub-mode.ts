import {requireHub,type HubState} from './hub-state.ts';
export function setHubModePreference(h:HubState,mode:'manual'|'semi'|'auto'){
 requireHub(['manual','semi','auto'].includes(mode),'HUB_MODE','请选择手动、半自动或全自动。');h.mode=mode;return {mode};
}
export const hubModePreference=(h:HubState)=>h.mode??'semi';
