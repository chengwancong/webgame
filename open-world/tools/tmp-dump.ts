import {report,length} from './copy-voice-scan.ts';
const {entries}=report();
const limit=Number(process.argv[2]??30);
const only=process.argv[3];
const list=entries.filter(e=>(!only||e.group===only)&&length(e.text)>limit&&!e.text.includes('{…}'));
console.log('长文案',list.length);
for(const e of list)console.log(`${e.group} ${e.file}:${e.line} (${length(e.text)}) ${e.text}`);
