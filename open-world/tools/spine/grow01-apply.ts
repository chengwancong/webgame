import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import accepted from './data/grow01-accepted-deviation.json';
const basis=accepted.decision+' Evidence SHA256 '+accepted.derivationSha256;
const changes:SpineChange[]=[
 {file:'packages/content/skill-costs.json',path:['throwing_knife'],before:3,after:accepted.knifeCost,basis},
 {file:'packages/content/skill-coefficients.json',path:['explosive_kunai'],before:2.74,after:accepted.kunaiCoefficient,basis},
];
console.log(JSON.stringify(await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/GROW01-20261020'})));
