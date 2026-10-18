import {skillTags} from './skill-tags.ts';
export function mechanismTags(s:Parameters<typeof skillTags>[0]):ReturnType<typeof skillTags>{const tags=skillTags(s);return s.kind==='dash'&&!tags.includes('dash')?[...tags,'dash']:tags;}
/** Runtime parameters already contain the server's frozen tag classification. */
export function resolvedSkillTags(s:Parameters<typeof skillTags>[0]&{tags?:readonly string[]}):ReturnType<typeof skillTags>{return s.tags?[...s.tags] as ReturnType<typeof skillTags>:skillTags(s);}
export function resolvedMechanismTags(s:Parameters<typeof skillTags>[0]&{tags?:readonly string[]}):ReturnType<typeof skillTags>{const tags=resolvedSkillTags(s);return s.kind==='dash'&&!tags.includes('dash')?[...tags,'dash']:tags;}
