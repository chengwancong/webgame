"""Mechanical rectangular crop copies only; no repaint, alpha threshold, runtime, pose or source mutation."""
from pathlib import Path
from PIL import Image
import json,hashlib
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'sets'
IDS=['100011','100031','100041','100061','100092','200291','200311','300571','400105','400108']
# Visible sleeve/cuff-to-palm boundary candidates, manually inspected on source PNGs. Not claimed original wrist bones.
CUTS={'100011':(17,17),'100031':(18,18),'100041':(19,18),'100061':(17,17),'100092':(19,19),'200291':(19,19),'200311':(18,18),'300571':(19,19),'400105':(18,18),'400108':(18,18)}
ANCHORS={'front':{'upperShoulderPx':[9.234948,10.141273],'upperElbowPx':[17.246352100586794,26.345602802157856],'forearmElbowPx':[10.911820496177668,7.396546233571025],'handGripPx':[16.5,20.5]},'back':{'upperShoulderPx':[17.898883,12.831145],'upperElbowPx':[14.829065907657963,28.513205547630996],'forearmElbowPx':[19.63568890765796,8.395805547630992],'handGripPx':[14.5,20.5]}}
sha=lambda b:hashlib.sha256(b).hexdigest()
allsets=[]
for sid in IDS:
 dest=HERE/sid;dest.mkdir(parents=True,exist_ok=True);parts=[]
 for side,cut in zip(['front','back'],CUTS[sid]):
  path=SOURCE/sid/(side+'_hand.png');raw=path.read_bytes();source=Image.open(path).convert('RGBA');w,h=source.size
  assert (w,h)==(32,32)
  wrist=[16.5 if side=='front' else 14.5,cut-.5]
  rectangles={'forearm':[0,0,w,min(h,cut+2)],'palm':[0,max(0,cut-2),w,h-max(0,cut-2)]}
  roles={}
  for role,rect in rectangles.items():
   x,y,rw,rh=rect;image=Image.new('RGBA',(w,h),(0,0,0,0));crop=source.crop((x,y,x+rw,y+rh));image.paste(crop,(x,y))
   target=dest/(side+'_'+role+'.png');image.save(target)
   assert image.crop((x,y,x+rw,y+rh)).tobytes()==crop.tobytes()
   roles[role]={'path':str(target.resolve()),'suggestedPublicPath':f'/art/wardrobe/native-arm-parts/{sid}/{side}_{role}.png','width':w,'height':h,'sourceRect':rect,'sourceRGBAUnchangedInsideRect':True,'decodedRGBAHash':sha(image.tobytes()),'alphaBBox':image.getchannel('A').getbbox()}
  # A disjoint neutral-rest composite exactly equals the original bitmap; overlap clips are for bent-joint coverage.
  neutral=Image.new('RGBA',(w,h),(0,0,0,0));neutral.paste(source.crop((0,0,w,cut)),(0,0));neutral.paste(source.crop((0,cut,w,h)),(0,cut));assert neutral.tobytes()==source.tobytes()
  parts.append({'side':side,'logicalPart':side+'_hand','sourcePath':str(path.resolve()),'sourceSha256':sha(raw),'sourceCanvas':[w,h],**ANCHORS[side],'wristPx':wrist,'wristBasis':'Visible cuff/palm boundary candidate, ±1.5sourcepx; original15-bone rig has no independent wrist, must validate on actual native-motion frames','elbowBasis':'Original sword setup oldhand bone origin inverse through RegionAttachment affine; not bbox center','splitY':cut,'overlapRows':[cut-2,cut+1],'overlapPixels':4,'roles':roles,'neutralExactRects':{'forearm':[0,0,w,cut],'palm':[0,cut,w,h-cut]},'neutralExactRGBA':True,'gripBasis':'Existing calibrated source bitmap knuckle point; does not by itself prove realistic art hold','layerOrder':['upperArm','forearm','weapon','palm'],'mirrorPolicy':'Mirror complete actor/root. Do not pre-mirror source bitmaps or independently flip bones.'})
  assert sha(path.read_bytes())==sha(raw)
 meta={'schemaVersion':1,'setId':sid,'coordinateSystem':'source-PNG-pixels-x-right-y-down','status':'technical-overlap-crops-for-pose-review','artSource':'Existing formal shipped2D wardrobe images, no GameRes character art','sourcePixelsSemanticallyEdited':False,'parts':parts,'integration':'Upper arm remains original front_arm/back_arm. Forearm maps elbow→wrist; independent palm follows actual wrist. Keep logicalhand.matrix for palm/Grip source coordinate. Runtime owner chooses regions/technical texture copies; no runtime modified here.','limits':['Every original source pixel retained inside each rectangle; no joint cap or new finger/skin invented.','Overlapping antialiased edge pixels can be double-painted in neutral pose; neutralExactRects supplied for exact original rest composite.','Large elbow bends and wrist rolls require actual pose/weapon/mirror visual review; Grip error0 alone is not approval.']}
 (dest/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8');allsets.append(meta)
(HERE/'manifest.json').write_text(json.dumps({'schemaVersion':1,'sets':IDS,'sourceUntouched':True,'runtimeAndPosesUnchanged':True,'metadata':allsets},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('10source sets /40 RGBA-preserving technical crops / exact disjoint rest verified.')
