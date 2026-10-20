export {group,root,publicRoot,library,fxLibrary,sharp,sha,rel,json,record,boot,load,render,pixels} from './pipeline.mjs';
import {out as parentOut} from './pipeline.mjs';import {join} from 'node:path';export const out=join(parentOut,'r2');
