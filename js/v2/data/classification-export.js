/* Export the exact server ranking. Cells are strings, never executable formulas. */
const HEADERS=['Puesto','Participante','Plaza','Recorrido','Distancia','Penalización','Desc./Pend.','Tiempo oficial','Dif. líder','Estado'];
const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function exportFilename(eventId,view,extension){return `clasificacion_${eventId}_${view}`.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,160)+'.'+extension;}
export function saveBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},30000);}
export async function classificationExcel(rows){
 if(!globalThis.JSZip)throw Error('No se pudo cargar Excel. Comprueba la conexión y vuelve a intentarlo.');
 const zip=new globalThis.JSZip(),ns='http://schemas.openxmlformats.org';
 zip.file('[Content_Types].xml',`<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
 zip.file('_rels/.rels',`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 zip.file('xl/workbook.xml',`<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Clasificación" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',`<styleSheet xmlns="${ns}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf fontId="1" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
 const all=[HEADERS,...rows],widths=[9,38,16,18,16,17,16,19,17,19];
 zip.file('xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${all.map((row,i)=>`<row r="${i+1}" ht="40" customHeight="1">${row.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr" s="${i===0?1:0}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:J${all.length}"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`);
 return zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export async function classificationPdf(rows,title,view){
 const Pdf=globalThis.jspdf?.jsPDF||await globalThis.ensureJsPdf?.();
 if(!Pdf)throw Error('No se pudo cargar PDF. Comprueba la conexión y vuelve a intentarlo.');
 const pdf=new Pdf({orientation:'landscape',unit:'mm',format:'a4'}),widths=[12,57,20,25,22,27,23,29,25,33];
 let y=0,page=0;
 const clean=v=>String(v??'').replace(/—/g,'-').replace(/…/g,'...');
 function heading(){page++;pdf.setTextColor(25,45,30);pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.text(pdf.splitTextToSize(clean(title),275).slice(0,2),12,13);pdf.setFontSize(9);pdf.text(clean(`Clasificación ${view} · ${new Date().toLocaleDateString('es-ES')} · Página ${page}`),12,28);y=34;draw(HEADERS,true);}
 function draw(row,head=false){
  pdf.setFont('helvetica',head?'bold':'normal');pdf.setFontSize(head?7.5:8);
  const lines=row.map((v,i)=>pdf.splitTextToSize(clean(v),widths[i]-3));
  const height=Math.max(10,...lines.map(l=>l.length*3.7+4));
  if(!head&&y+height>198){pdf.addPage();heading();}
  let x=12;
  if(head){pdf.setFillColor(225,233,219);pdf.rect(12,y,273,height,'F');}
  lines.forEach((l,i)=>{pdf.text(l,x+1.5,y+4);x+=widths[i];});
  pdf.setDrawColor(210);pdf.line(12,y+height,285,y+height);y+=height;
 }
 heading();for(const row of rows)draw(row);return pdf.output('blob');
}
