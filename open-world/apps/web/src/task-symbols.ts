import type {TaskType} from '../../../packages/contracts/tasks.ts';
// Small code-native UI marks. Color and shape both identify each task type.
const drawings:Record<string,string>={
 banner:'<path d="M9 5v24" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M11 6h15l-4 7 4 7H11z" fill="currentColor" opacity=".9"/><path d="m17 9 2 4-2 4-2-4z" fill="var(--color-panel)"/><path d="M5 29h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 portal:'<path d="M7 26V14a9 9 0 0 1 18 0v12" fill="currentColor" opacity=".25"/><path d="M7 26V14a9 9 0 0 1 18 0v12M11 26V15a5 5 0 0 1 10 0v11M5 27h22M9 30h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m16 9 2 4-2 4-2-4z" fill="currentColor"/>',
 feather:'<path d="M8 23C5 10 17 4 28 5c0 11-7 22-18 18" fill="currentColor" opacity=".28"/><path d="M7 25C5 12 17 5 27 5c0 11-7 21-17 19M5 29 23 9M12 21l-1-7m7 1 6 1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
 compass:'<circle cx="16" cy="16" r="11" fill="currentColor" opacity=".12"/><path d="M16 2v5m0 18v5M2 16h5m18 0h5" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m21 11-3 7-7 3 3-7z" fill="currentColor"/>',
 book:'<path d="M16 9c-4-4-10-3-12-2v19c3-2 8-2 12 1 4-3 9-3 12-1V7c-2-1-8-2-12 2z" fill="currentColor" opacity=".16"/><path d="M16 9c-4-4-10-3-12-2v19c3-2 8-2 12 1 4-3 9-3 12-1V7c-2-1-8-2-12 2zm0 0v18M8 12l4 1m-4 4 4 1m8-5 4-1m-4 6 4-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
 chest:'<path d="M4 14h24v13H4zM5 14V9c0-3 22-3 22 0v5" fill="currentColor" opacity=".18"/><path d="M4 14h24v13H4zM5 14V9c0-3 22-3 22 0v5m-17 1v11m12-11v11M3 18h26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><rect x="14" y="16" width="4" height="6" rx="1" fill="currentColor"/>',
 clock:'<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9v8l5 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
 check:'<path d="m7 16 6 6L26 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
 hourglass:'<path d="M9 5h14M9 27h14M10 5v6l12 10v6M22 5v6L10 21v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m12 23 4-4 4 4z" fill="currentColor"/>',
 alert:'<path d="m16 4 13 24H3z" fill="currentColor" opacity=".18"/><path d="m16 4 13 24H3zM16 12v7m0 4v1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
 diamond:'<path d="m16 4 12 12-12 12L4 16z" fill="currentColor" opacity=".18"/><path d="m16 4 12 12-12 12L4 16z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="3" fill="currentColor"/>'
};
export function symbol(name:string,className=''){return `<svg class="desk-symbol ${className}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${drawings[name]??drawings.diamond}</svg>`;}
export function typeVisual(registry:TaskType[],id:string){const type=registry.find(t=>t.id===id);return {tone:type&&['gold','violet','teal'].includes(type.tone)?type.tone:'neutral',icon:type?.icon&&Object.hasOwn(drawings,type.icon)?type.icon:'diamond'};}
export function stateSymbol(state:string){return ({ready:'chest',claimed:'check',active:'compass',pending:'hourglass',failed:'alert',busy:'hourglass'} as Record<string,string>)[state]??'diamond';}
