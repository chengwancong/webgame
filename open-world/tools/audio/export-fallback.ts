import {writeFileSync,mkdirSync} from 'node:fs';
import {cueRecipes} from '../../apps/web/src/audio/sound-recipes.ts';
import {soundProfiles} from '../../apps/web/src/audio/sound-profiles.ts';
import {synthGain} from '../../apps/web/src/audio/mixer.ts';
mkdirSync('.qa/audio-production',{recursive:true});
writeFileSync('.qa/audio-production/fallback-recipes.json',JSON.stringify({synthGain,rows:[...['hit','crit','hurt','kill','shield-break'].map(key=>({key:'cue/'+key,stage:'one',recipe:cueRecipes[key]})),...['cut','fireball','frost_bolt'].map(key=>({key:'player/'+key,stage:'impact',recipe:soundProfiles['player/'+key].impact}))]},null,1));
