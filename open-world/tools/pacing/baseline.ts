import {measurePacingBuilds} from './measure.ts';
const result=await measurePacingBuilds({output:'docs/reviews/pacing-tool-20261010/P0'});
console.log(JSON.stringify(result.matrix));
