import {art} from '../ui-assets.ts';
import {buttonHtml,escapeHtml,type ButtonOptions} from './primitives.ts';
export const questHudHeader=(title:string)=>`<strong class="hud-quest-kicker"><img src="${art('item-skill-book')}" alt="" aria-hidden="true"><span>${escapeHtml(title)}</span></strong>`;
export const questHudButton=(label:string,options:ButtonOptions={})=>buttonHtml(label,{...options,size:'compact',variant:'quiet',className:'hud-quest-action '+(options.className??'')});
