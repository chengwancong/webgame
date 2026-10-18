import {resolve} from 'node:path';
/** Test evidence may be redirected without changing business behavior or old reports. */
export function reviewPath(path:string){const prefix='docs/reviews/open-world-m2-m4/';return process.env.AW_REVIEW_ROOT&&path.startsWith(prefix)?resolve(process.env.AW_REVIEW_ROOT,path.slice(prefix.length)):path;}
