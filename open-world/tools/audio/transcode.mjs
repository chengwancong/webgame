/** 运行时压缩版：委托 tools/audio/compress.py（libsndfile 编 Ogg Vorbis，无需 ffmpeg），WAV 源保留。 */
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const run=spawnSync(process.env.AW_PYTHON??'python',['-X','utf8','tools/audio/compress.py',...process.argv.slice(2)],{cwd:root,stdio:'inherit'});process.exit(run.status??1);
