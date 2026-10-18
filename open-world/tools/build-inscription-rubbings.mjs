import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {inspectPng} from './equipment-art/common.mjs';
const sourceRoot='assets/ui-source/v2',folder='inscription-rubbings',runtimeRoot='apps/web/public/art/ui-v2';
const rubbings=JSON.parse(await readFile('packages/content/inscription-rubbings.json','utf8'));
if(rubbings.length!==41||new Set(rubbings.map(r=>r.id)).size!==41)throw Error('Expected 41 unique inscription rubbings');
const {colors}=JSON.parse(await readFile(sourceRoot+'/ui-source.json','utf8'));
const ink=colors.slate_blue,cream=colors.warm_cream,gold=colors.apricot_gold,blue=colors.magic_blue,red=colors.coral_red;
// New code-native rune drawings. Large contours carry meaning at 32/48px;
// a folded rubbing sheet and a small slot seal identify the inventory object.
const motifs={
 ignite:['fire',`M128 75 Q145 94 142 109 Q165 98 165 127 Q169 161 132 173 Q93 169 93 133 Q96 111 116 99 Q110 125 124 125 Q145 119 128 75Z`],
 chill:['ice',`M128 79 L128 170 M87 101 L170 149 M87 149 L170 101 M113 87 L128 100 L143 87 M113 161 L128 148 L143 161 M91 117 L109 117 L107 100 M149 150 L149 132 L166 134`],
 shock:['lightning',`M133 77 L101 129 L126 129 L116 172 L157 113 L134 113Z`],
 poison:['poison',`M128 83 Q115 107 98 130 Q83 153 105 169 Q135 184 156 161 Q166 140 146 118Z M112 144 Q121 139 122 151 M136 150 Q143 138 151 142`],
 bleed:['blood',`M98 93 Q105 130 94 162 M127 89 Q135 128 125 166 M156 96 Q163 129 152 161`],
 'shadow-bite':['shadow',`M101 87 Q160 81 166 126 Q160 170 109 167 Q145 151 144 130 Q143 106 101 87Z M111 124 L123 148 L132 120`],
 opening:['gold',`M92 157 L128 83 L161 157 L128 143Z M80 93 L94 104 M165 92 L151 104`],
 edge:['gold',`M96 161 Q131 140 151 83 L162 98 Q151 154 96 161Z M104 157 L92 169 M93 151 L107 166`],
 split:['gold',`M128 172 L128 126 M128 126 L97 89 M128 126 L158 89 M88 111 L97 89 L118 96 M137 95 L158 89 L166 111`],
 cascade:['blue',`M96 93 L96 159 M128 83 L128 168 M160 95 L160 159 M85 107 L96 93 L107 107 M117 97 L128 83 L139 97 M149 109 L160 95 L171 109`],
 afterimage:['shadow',`M146 85 L111 114 L139 145 L105 171 M124 84 L90 112 L118 143 M161 114 L148 125`],
 'arrow-stack':['gold',`M96 160 L145 89 M126 94 L145 89 L149 109 M109 171 L158 100 M139 105 L158 100 L162 120 M87 146 L132 81`],
 thunder:['lightning',`M94 107 Q91 86 114 88 Q130 67 147 88 Q171 91 165 114 L94 114 M137 114 L115 141 L137 141 L124 170`],
 bulwark:['gold',`M96 93 L128 81 L161 93 L157 137 Q150 162 128 173 Q102 161 97 138Z M128 97 L128 151`],
 thorns:['gold',`M128 86 L145 114 L171 112 L154 137 L162 163 L132 154 L107 172 L107 144 L83 128 L109 119Z`],
 'ice-armor':['ice',`M99 91 L127 80 L158 91 L159 137 L128 173 L98 138Z M128 100 L128 148 M106 111 L150 138 M105 138 L150 112`],
 desperate:['red',`M97 97 L128 82 L158 97 L151 143 L128 170 L105 143Z M115 112 L140 139 M140 112 L115 139`],
 drinking:['blood',`M94 115 L159 115 Q155 154 128 157 Q102 152 94 115Z M128 158 L128 171 M109 173 L148 173 M124 81 Q108 108 127 110 Q145 107 124 81Z`],
 focus:['blue',`M90 126 Q127 87 168 126 Q128 163 90 126Z M128 107 A19 19 0 1 0 128 145 A19 19 0 1 0 128 107 M128 117 L128 135`],
 bone:['gold',`M99 101 Q87 89 91 82 Q104 73 113 86 L148 142 Q164 139 166 154 Q160 168 147 160 Q141 175 127 166 Q122 156 136 151 L103 99 Q89 110 85 98 Q84 88 99 101Z`],
 suppress:['blue',`M93 97 L165 97 M100 123 L158 123 M113 148 L145 148 M129 82 L129 174 M115 158 L129 174 L143 158`],
 bloodthirst:['blood',`M128 172 Q90 144 89 119 Q91 96 109 95 Q123 95 128 110 Q134 92 151 95 Q170 101 168 121 Q161 147 128 172Z M128 118 L122 140 L136 140`],
 overflow:['blue',`M99 109 L156 109 L156 164 L99 164Z M91 126 L164 126 M117 91 L117 72 M136 91 L136 78 M100 98 Q89 88 95 79 M155 97 Q170 83 163 77`],
 'fire-path':['fire',`M101 163 Q111 136 108 111 Q130 132 128 156 Q135 123 150 91 Q173 132 149 168Z M96 86 L102 96 M128 76 L134 87`],
 evasion:['shadow',`M112 92 L144 116 L128 147 L153 171 M143 82 L128 107 L97 125 M84 97 L99 103 M78 144 L99 144`],
 'whirl-edge':['gold',`M98 92 Q165 72 173 124 Q177 164 126 175 Q81 179 79 136 Q80 106 116 105 Q144 108 145 131 Q144 147 123 149 M121 137 L128 119 L141 130`],
 tailwind:['blue',`M82 109 L146 109 Q169 109 164 92 Q154 78 141 92 M91 131 L170 131 M83 151 L134 151 Q158 151 151 169 Q137 180 126 165`],
 quake:['gold',`M101 82 L147 82 L148 109 L101 110Z M124 112 L124 145 M89 171 L110 150 L125 161 L144 145 L169 173`],
 aftershock:['gold',`M83 146 Q128 110 174 147 M97 130 Q126 98 157 130 M111 113 Q127 95 143 113 M127 153 L127 173`],
 wildfire:['fire',`M101 169 Q78 139 97 111 Q101 135 116 129 Q123 114 118 89 Q153 104 145 130 Q159 136 161 117 Q180 152 152 173Z`],
 overload:['lightning',`M128 81 L135 115 L166 96 L145 126 L176 141 L142 143 L153 174 L128 150 L101 171 L111 143 L80 133 L110 123 L96 96 L120 114Z`],
 'poison-burst':['poison',`M111 115 Q98 140 119 154 Q143 164 152 141 Q159 118 132 106Z M92 88 L108 101 M153 87 L145 101 M170 156 L153 149 M97 174 L109 160`],
 shatter:['ice',`M128 88 L140 119 L128 148 L113 119Z M83 109 L103 113 L99 138Z M151 118 L174 103 L166 139Z M104 166 L115 144 L128 172Z M145 147 L158 170 L136 165Z`],
 'poison-cloud':['poison',`M98 154 Q81 150 84 133 Q86 118 100 119 Q93 93 117 93 Q129 76 143 99 Q164 94 167 117 Q181 131 165 152Z M115 162 L110 177 M143 161 L147 175`],
 'night-feast':['shadow',`M146 80 Q109 103 120 140 Q125 164 155 166 Q96 178 89 131 Q84 91 146 80Z M145 111 L149 121 L160 125 L149 130 L145 141 L140 130 L130 125 L140 121Z`],
 'battle-will':['gold',`M97 165 L151 86 L162 95 L107 173 M91 91 L157 169 M98 153 L116 170 M144 154 L161 136`],
 energy:['blue',`M127 81 L151 109 L138 135 L115 135 L101 109Z M118 140 L118 155 L137 155 L137 140 M127 159 L127 174 M89 102 L80 98 M167 101 L177 96`],
 refund:['blue',`M154 99 Q115 77 96 110 Q78 143 113 161 Q145 177 163 144 M159 84 L154 99 L138 101 M110 116 L139 116 M125 104 L125 147`],
 cycle:['gold',`M110 90 Q156 76 166 120 M154 102 L166 120 L176 105 M151 163 Q103 176 89 133 M102 148 L89 133 L82 150 M128 111 L143 127 L128 144 L113 127Z`],
 'time-return':['blue',`M106 88 L152 88 M106 166 L152 166 M111 91 Q110 113 130 126 Q150 143 147 163 M147 91 Q147 112 130 126 Q108 143 111 163 M81 136 Q67 105 91 95 M76 99 L91 95 L95 110`],
 terror:['shadow',`M97 101 Q100 82 129 83 Q160 81 161 107 L157 141 L143 153 L141 170 L115 170 L113 153 L98 140Z M110 112 L119 122 M147 113 L138 122 M123 139 L129 130 L135 139`],
};
const seals={weapon:'M0 15 L24 -13 L30 -7 L7 20 M-3 9 L11 21',armor:'M-18 -14 L-4 -20 L4 -20 L18 -14 L14 6 L7 3 L8 20 L-8 20 L-7 3 L-14 6Z',helmet:'M-19 15 L-19 -2 Q0 -27 19 -2 L19 15 M-14 13 L14 13',boots:'M-13 -18 L1 -18 L3 8 Q21 8 19 20 L-14 20Z',accessory:'M-15 -19 Q-29 6 0 19 Q29 6 15 -19 M0 12 L7 20 L0 28 L-7 20Z',ring:'M-14 8 A14 14 0 1 0 14 8 A14 14 0 1 0 -14 8 M-8 -13 L0 -21 L8 -13 L0 -4Z'};
await mkdir(sourceRoot+'/'+folder,{recursive:true});await mkdir(runtimeRoot+'/'+folder,{recursive:true});
const records=[],hashes=new Set();
for(const item of rubbings){const key=item.atomId.replace(/^atom-/,''),motif=motifs[key];if(!motif||!seals[item.slot])throw Error('Missing rune drawing '+item.id);
 const [theme,path]=motif,color=['fire','blood','red'].includes(theme)?red:['ice','blue','lightning'].includes(theme)?blue:theme==='poison'?'#7CB783':theme==='shadow'?'#9780BB':gold;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><g stroke="${ink}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"><path d="M59 42 Q129 34 183 42 L197 189 Q153 220 68 209 L52 68Z" fill="${cream}"/><path d="M58 45 Q119 52 183 42 M68 208 Q126 196 197 189 M183 42 L176 67 L192 69" fill="none" opacity=".65"/><path d="${path}" fill="none" stroke="${color}" stroke-width="11"/><g transform="translate(168 189) scale(.68)"><path d="M-24 -25 L24 -25 L28 25 L-24 28Z" fill="${gold}" stroke-width="6"/><path d="${seals[item.slot]}" fill="none" stroke-width="5"/></g></g></svg>`;
 const bytes=await sharp(Buffer.from(svg)).png().toBuffer(),check=await inspectPng(bytes,item.id,{production:true}),sha=createHash('sha256').update(bytes).digest('hex');if(hashes.has(sha))throw Error('Shared rubbing pixels');hashes.add(sha);
 const file=folder+'/'+item.id+'.png';await writeFile(sourceRoot+'/'+file,bytes);await writeFile(runtimeRoot+'/'+file,bytes);await writeFile(sourceRoot+'/'+folder+'/'+item.id+'.svg',svg+'\n');records.push({...item,assetId:'item-material-'+item.id,file,sha256:sha,normalized:check});
}
const sourcePath=sourceRoot+'/ui-source.json',source=JSON.parse(await readFile(sourcePath,'utf8')),runtimePath='packages/asset-manifest/ui.v2.json',runtime=JSON.parse(await readFile(runtimePath,'utf8')),ids=new Set(records.map(r=>r.assetId));
source.assets=source.assets.filter(a=>!ids.has(a.id));source.assets.push(...records.map(r=>({id:r.assetId,kind:'item',file:r.file,size:[256,256]})));
for(const r of records)runtime.assets[r.assetId]={kind:'item',path:'/art/ui-v2/'+r.file,size:[256,256],sha256:r.sha256};
await writeFile(sourcePath,JSON.stringify(source,null,2)+'\n');await writeFile(runtimePath,JSON.stringify(runtime,null,2)+'\n');
await writeFile(sourceRoot+'/'+folder+'/catalog.json',JSON.stringify({count:records.length,style:'code-native rubbing sheets with unique large rune motifs and slot seals',generator:'tools/build-inscription-rubbings.mjs',items:records},null,2)+'\n');
const sheet=await sharp({create:{width:8*128,height:6*128,channels:4,background:'#F7F1E6'}}).composite(await Promise.all(records.map(async(r,i)=>({input:await sharp(sourceRoot+'/'+r.file).resize(112,112).toBuffer(),left:(i%8)*128+8,top:Math.floor(i/8)*128+8})))).png().toBuffer();
await mkdir('docs/reviews/build-variety-r6-20261006/inscription-art',{recursive:true});await writeFile('docs/reviews/build-variety-r6-20261006/inscription-art/contact-sheet.png',sheet);await writeFile('docs/reviews/build-variety-r6-20261006/inscription-art/result.json',JSON.stringify({ok:true,count:records.length,uniqueHashes:hashes.size,source:'code-native vectors rendered through sharp; no shared fallback artwork',assets:records.map(({normalized,...r})=>r)},null,2)+'\n');
console.log(JSON.stringify({ok:true,count:records.length,uniqueHashes:hashes.size}));
