from pathlib import Path
import xlrd, fitz, json, hashlib
root=Path.cwd()
book=xlrd.open_workbook(str(root/'ITEMS.xls'),formatting_info=True)
result={'sha256':hashlib.sha256((root/'ITEMS.xls').read_bytes()).hexdigest(),'sheets':[]}
for sheet in book.sheets():
 result['sheets'].append({'name':sheet.name,'rows':sheet.nrows,'columns':sheet.ncols,'sample':[sheet.row_values(i) for i in range(min(12,sheet.nrows))]})
print(json.dumps(result,ensure_ascii=False,indent=2))
doc=fitz.open(root/'MA-3210.pdf')
print('PDF pages:',len(doc))
print(doc[0].get_text())
(root/'output/qa').mkdir(parents=True,exist_ok=True)
doc[0].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(root/'output/qa/reference.png')
