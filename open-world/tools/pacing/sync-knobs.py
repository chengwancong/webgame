"""只更新机制旋钮页XML，原目标页、样式、批注等ZIP成员逐字节保留。"""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import xml.etree.ElementTree as E
import json,sys,hashlib
root=Path(__file__).resolve().parents[2];file=root/'config/excel/节奏目标.xlsx';data=json.loads((root/'config/json/pacing-mechanism-knobs.json').read_text(encoding='utf-8'))
ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';q=lambda x:'{'+ns+'}'+x
with ZipFile(file) as z: entries={i.filename:(i,z.read(i.filename)) for i in z.infolist()}
wb=E.fromstring(entries['xl/workbook.xml'][1]);rels=E.fromstring(entries['xl/_rels/workbook.xml.rels'][1]);rid=next(s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'] for s in wb.find(q('sheets')) if s.attrib['name']=='机制旋钮');target=next(r.attrib['Target'] for r in rels if r.attrib['Id']==rid);sheet=target.lstrip('/') if target.startswith('/') else 'xl/'+target
tree=E.fromstring(entries[sheet][1]);body=tree.find(q('sheetData'));previous_formats={'rows':{r.attrib['r']:dict(r.attrib) for r in body},'cells':{c.attrib['r']:{k:v for k,v in c.attrib.items() if k!='t'} for c in tree.iter(q('c'))}};body.clear()
cols=[('bd','构筑','string'),('aspect','词条','string'),('rule','规则','string'),('kind','路径种类','string'),('path','参数路径','json'),('step','步长','number'),('min','旧下限','number'),('max','旧上限','number'),('marginal','实测弹性','json'),('generic','通用兜底','bool'),('unit','单位','string'),('basis','测量依据','string'),('role','角色','string'),('design','设计初值','number'),('floor','设计下限','number'),('ceiling','设计上限','number'),('scenes','目标场景','list'),('scale','弹性标度','string')]
def letter(n):
 s=''
 while n: n,r=divmod(n-1,26);s=chr(65+r)+s
 return s
rows=[[c[1] for c in cols],[c[0] for c in cols],[c[2] for c in cols]]
for i,k in enumerate(data['knobs'],4):
 k['_row']=i;row=[]
 for key,_,typ in cols:
  v=k.get(key)
  if typ=='json':v=json.dumps(v,ensure_ascii=False,separators=(',',':'))
  if typ=='list':v='|'.join(v or [])
  row.append(v)
 rows.append(row)
formats_path=root/'docs/reviews/pacing-identity-20261013/C1/workbook-original-format.json'
formats=json.loads(formats_path.read_text(encoding='utf-8')) if formats_path.exists() else previous_formats
for r,values in enumerate(rows,1):
 row_attrs=dict(formats['rows'].get(str(r),formats['rows'].get('4',{'r':str(r)})));row_attrs['r']=str(r)
 row=E.SubElement(body,q('row'),row_attrs)
 for c,v in enumerate(values,1):
  ref=letter(c)+str(r);template=(letter(min(c,12))+str(r if str(r) in formats['rows'] else 4));attrs=dict(formats['cells'].get(ref,formats['cells'].get(template,{})));attrs['r']=ref;cell=E.SubElement(row,q('c'),attrs)
  if isinstance(v,bool):cell.set('t','b');E.SubElement(cell,q('v')).text='1' if v else '0'
  elif isinstance(v,(int,float)):E.SubElement(cell,q('v')).text=str(v)
  elif v is not None:cell.set('t','inlineStr');E.SubElement(E.SubElement(cell,q('is')),q('t')).text=str(v)
dim=tree.find(q('dimension'))
if dim is not None:dim.set('ref','A1:R'+str(len(rows)))
E.register_namespace('',ns);new=E.tostring(tree,encoding='utf-8',xml_declaration=True)
tmp=file.with_suffix('.identity.tmp')
with ZipFile(tmp,'w',ZIP_DEFLATED) as z:
 for name,(info,value) in entries.items():z.writestr(info,new if name==sheet else value)
tmp.replace(file)
with ZipFile(file) as z: changed=[n for n,(_,v) in entries.items() if z.read(n)!=v]
assert changed==[sheet],changed
out=root/'docs/reviews/pacing-identity-20261013';(out/'C1').mkdir(exist_ok=True);(out/'C1/workbook-preservation.json').write_text(json.dumps({'changedMembers':changed,'targetSheetsStyleCommentsDifference':0,'method':'原ZIP成员原样保留，仅更新机制旋钮页数据节点'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
