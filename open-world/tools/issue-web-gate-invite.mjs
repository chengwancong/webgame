throw Error('站点验证已停用，无需邀请。直接访问 https://43-165-179-11.sslip.io/');
// Historical implementation retained below; never executed while site access is open.
// The output URL is a temporary credential: share only with the intended tester.
import { execFileSync } from 'node:child_process';
const code = "const r=await fetch('http://127.0.0.1:8080/issue-invite',{method:'POST',headers:{authorization:'Bearer '+process.env.AW_GATE_SESSION_KEY}});if(!r.ok)throw Error('Issue failed: '+r.status);const v=await r.json();console.log(JSON.stringify({...v,expiresAtShanghai:new Date(v.expiresAt).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'})}));";
const quote = s => "'" + s.replaceAll("'", "'\\''") + "'";
const command = 'docker exec abyss-staging-web-gate-1 node --input-type=module -e ' + quote(code);
const result = execFileSync('C:/Program Files/Git/usr/bin/ssh.exe', ['abyss-staging', command], { encoding: 'utf8', windowsHide: true });
console.log(result.trim());
