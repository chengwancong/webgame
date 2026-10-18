"""主干专用页的OOXML增量写入；原目标页、样式、批注逐字节保留。"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import xml.etree.ElementTree as E
import json, sys, hashlib

ROOT=Path(__file__).resolve().parents[2]
FILE=ROOT/'config/excel/节奏目标.xlsx'
REVIEW=ROOT/'docs/reviews/numeric-spine-20261013'
NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL='http://schemas.openxmlformats.org/package/2006/relationships'
DOCREL='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
CT='http://schemas.openxmlformats.org/package/2006/content-types'
q=lambda s:'{'+NS+'}'+s

def publish(data, name='主干目标'):
    assert name in ['主干目标','标准人曲线','属性权重','预算审计','怪物曲线']
    with ZipFile(FILE) as z: original={i.filename:(i,z.read(i.filename)) for i in z.infolist()}
    entries={k:v for k,(_,v) in original.items()}
    wb=E.fromstring(entries['xl/workbook.xml']); rels=E.fromstring(entries['xl/_rels/workbook.xml.rels']); types=E.fromstring(entries['[Content_Types].xml'])
    sheets=wb.find(q('sheets')); sheet=next((s for s in sheets if s.get('name')==name),None)
    if sheet is None:
        sid=max(int(s.get('sheetId')) for s in sheets)+1
        rid='rIdSpine'+str(sid); target='worksheets/spine'+str(sid)+'.xml'
        sheet=E.SubElement(sheets,q('sheet'),{'name':name,'sheetId':str(sid),'{'+DOCREL+'}id':rid})
        E.SubElement(rels,'{'+REL+'}Relationship',{'Id':rid,'Type':DOCREL+'/worksheet','Target':target})
        path='xl/'+target
        E.SubElement(types,'{'+CT+'}Override',{'PartName':'/'+path,'ContentType':'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'})
    else:
        rid=sheet.get('{'+DOCREL+'}id'); target=next(r.get('Target') for r in rels if r.get('Id')==rid); path=target.lstrip('/') if target.startswith('/') else 'xl/'+target
    columns=data['columns']; rows=data['rows']; root=E.Element(q('worksheet'))
    view=E.SubElement(E.SubElement(root,q('sheetViews')),q('sheetView'),{'workbookViewId':'0'})
    E.SubElement(view,q('pane'),{'ySplit':'3','topLeftCell':'A4','activePane':'bottomLeft','state':'frozen'})
    cols=E.SubElement(root,q('cols'))
    for i,(_,_,_,width) in enumerate(columns,1):E.SubElement(cols,q('col'),{'min':str(i),'max':str(i),'width':str(width),'customWidth':'1'})
    body=E.SubElement(root,q('sheetData'))
    def letter(i):
        s=''
        while i:i,r=divmod(i-1,26);s=chr(65+r)+s
        return s
    matrix=[[c[1] for c in columns],[c[0] for c in columns],[c[2] for c in columns]]+[[row.get(c[0]) for c in columns] for row in rows]
    for r,values in enumerate(matrix,1):
        row=E.SubElement(body,q('row'),{'r':str(r)})
        for c,value in enumerate(values,1):
            if value is None:continue
            cell=E.SubElement(row,q('c'),{'r':letter(c)+str(r)})
            if isinstance(value,bool):cell.set('t','b');E.SubElement(cell,q('v')).text='1' if value else '0'
            elif isinstance(value,(float,int)):E.SubElement(cell,q('v')).text=str(value)
            else:cell.set('t','inlineStr');E.SubElement(E.SubElement(cell,q('is')),q('t')).text=str(value)
    if name!='主干目标':E.SubElement(root,q('sheetProtection'),{'sheet':'1','objects':'1','scenarios':'1'})
    entries[path]=E.tostring(root,encoding='utf-8',xml_declaration=True)
    for p,tree in [('xl/workbook.xml',wb),('xl/_rels/workbook.xml.rels',rels),('[Content_Types].xml',types)]:
        E.register_namespace('',tree.tag.split('}')[0][1:]); E.register_namespace('r',DOCREL)
        entries[p]=E.tostring(tree,encoding='utf-8',xml_declaration=True)
    mutable={'xl/workbook.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml',path}
    changed=[p for p,(_,value) in original.items() if entries[p]!=value]
    assert all(p in mutable for p in changed),changed
    temp=FILE.with_suffix('.spine.tmp')
    with ZipFile(temp,'w',ZIP_DEFLATED) as z:
        for p,value in entries.items():z.writestr(original[p][0] if p in original else p,value)
    temp.replace(FILE)
    proof={'sheet':name,'rows':len(rows),'changedMembers':changed,'addedMembers':[p for p in entries if p not in original],
           'originalTargetStyleCommentDifference':0,'sha256':hashlib.sha256(FILE.read_bytes()).hexdigest()}
    proof_path=REVIEW/('S0/workbook-preservation.json' if name=='主干目标' else 'S9/'+name+'-preservation.json')
    proof_path.parent.mkdir(parents=True,exist_ok=True)
    proof_path.write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(proof,ensure_ascii=False))

if __name__=='__main__':
    source=Path(sys.argv[1]) if len(sys.argv)>1 else REVIEW/'S0/spine-targets-draft.json'
    data=json.loads(source.read_text(encoding='utf-8'))
    if 'targets' in data:data={'columns':[(k,n,t,w) for k,n,t,w in [('key','键','string',38),('levels','等级段','string',20),('value','数值','number',20),('unit','单位','string',18),('source','来源','string',12),('reference','来源位置','string',80),('locked','是否锁定','bool',12),('date','来源日期','string',16)]],'rows':data['targets']}
    publish(data,sys.argv[2] if len(sys.argv)>2 else '主干目标')
