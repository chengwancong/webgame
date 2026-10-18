import {flows as all} from '../v3/flows.mjs'; export const flows=all.filter(f=>['ember','glacier','arcanum'].includes(f.id));
