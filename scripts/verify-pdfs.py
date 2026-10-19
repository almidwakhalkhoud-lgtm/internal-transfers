from pathlib import Path
import json,re
import pymupdf
root=Path('output/qa')
for name in ['real-products-transfer','200-lines','barcode-fixture','employee-snapshot']:
 file=root/(name+'.pdf')
 if not file.exists():continue
 doc=pymupdf.open(file)
 texts=[page.get_text() for page in doc]
 assert all(text.strip() for text in texts),f'Blank page in {name}'
 for i,page in enumerate(doc):
  assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1,'Not A4'
  page.get_pixmap(matrix=pymupdf.Matrix(1.5,1.5)).save(root/f'{name}-{i+1}.png')
 if name=='200-lines':
  expected=json.loads((root/'200-lines-expected.json').read_text('utf8'))
  full='\n'.join(texts)
  # Each numeric code occupies its own cell and must occur exactly once, in saved order.
  codes=[]
  for page in doc:
   words=page.get_text('words')
   codes.extend(w[4] for w in words if 30<w[0]<160 and w[4] in {p['code'] for p in expected})
  assert codes==[p['code'] for p in expected],f'Incorrect item order/count: {len(codes)}'
  assert 'Total transferred quantity: 225' in full,'Incorrect total'
  assert full.count('Sender signature:')==1 and full.count('Receiver signature:')==1
  assert len(doc)>1,'Pagination not exercised'
 if name=='barcode-fixture':
  import zxingcpp
  from PIL import Image
  pix=doc[0].get_pixmap(matrix=pymupdf.Matrix(3,3))
  decoded=zxingcpp.read_barcodes(Image.frombytes('RGB',[pix.width,pix.height],pix.samples))
  assert '0012300119139' in [r.text for r in decoded],'Printed barcode did not decode exactly'
  print(json.dumps({'barcodeDecoded':[r.text for r in decoded],'leadingZerosPreserved':True}))
 if name=='employee-snapshot':
  full='\n'.join(texts)
  assert 'Employee: QA Staff' in full and 'Changed employee display name' not in full,'Employee was not snapshotted'
 print(json.dumps({'file':name,'pages':len(doc),'a4':True,'nonemptyPages':True}))
