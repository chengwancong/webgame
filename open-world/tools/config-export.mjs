import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const candidates=process.env.AW_PYTHON?[process.env.AW_PYTHON]:process.platform==='win32'?['python','python3']:['python3','python'];
let python;
for(const candidate of candidates){
 const probe=spawnSync(candidate,['-X','utf8','-c','import openpyxl; print("AW_CONFIG_PYTHON_OK")'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:10000});
 if(probe.status===0&&probe.stdout?.trim()==='AW_CONFIG_PYTHON_OK'){python=candidate;break;}
}
if(!python){
 console.error('配置导出未执行：找不到带 openpyxl 的 Python。请安装依赖，或将 AW_PYTHON 指向实际解释器（不能是 WindowsApps 占位入口）。');
 process.exitCode=1;
}else{
 const result=spawnSync(python,['-X','utf8','tools/config-export.py',...process.argv.slice(2)],{cwd:root,stdio:'inherit',windowsHide:true});
 if(result.error)console.error('配置导出启动失败：'+result.error.message);
 process.exitCode=result.status??1;
}
