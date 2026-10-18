import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Client} from 'pg';import {randomUUID,createHash} from 'node:crypto';
const pid=(await readFile('.runtime/dev/data/postmaster.pid','utf8')).split('\n');
const db=new Client({host:'127.0.0.1',port:Number(pid[3]),user:'aw_world',database:'postgres'});await db.connect();
try{
 const user=(await db.query("SELECT c.id,c.state,(SELECT jsonb_agg(data ORDER BY id) FROM ow_rewards WHERE character=c.id AND NOT claimed) pending FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE a.username='123'")).rows[0];
 const out='../docs/reviews/open-world/field-recovery-20261003';await mkdir(out,{recursive:true});
 if(user)await writeFile(out+'/user-save-before.json',JSON.stringify({username:'123',id:user.id,level:user.state.level,gold:user.state.gold,gear:user.state.gear.length,pending:user.pending?.length??0,safe:user.state.progress.safe,hash:createHash('sha256').update(JSON.stringify({state:user.state,pending:user.pending})).digest('hex')},null,2));
 const row=(await db.query("SELECT c.id,c.state FROM ow_characters c JOIN ow_accounts a ON a.id=c.account WHERE a.username='qa_field_states_1003'")).rows[0];
 if(!row||row.state.name!=='状态验收')throw Error('Dedicated browser fixture character missing');
 const s=row.state;s.progress.safe='meadow';delete s.progress.safePoint;s.gold=100;s.material=9;
 for(const g of s.gear){g.attack=1;g.armor=0;g.affixes=[];g.aspectId=undefined;g.rank=0;g.locked=false;g.quality='common';}
 s.gear[2].locked=true;s.gear[3].rank=1;s.gear[4].quality='legendary';s.progression.weaponGrid[1]=s.gear[5].id;
 while(s.gear.length<24)s.gear.push({...s.gear[0],id:randomUUID(),name:'待整理武器 '+s.gear.length,locked:false,rank:0,quality:s.gear.length%2?'magic':'rare'});
 s.revision++;s.build++;await db.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,row.id]);
 console.log(JSON.stringify({fixture:'qa_field_states_1003',name:s.name,gear:s.gear.length,safe:s.progress.safe}));
}finally{await db.end();}
