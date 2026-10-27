// Set SPREADSHEET_ID and LEADS_WEBHOOK_SECRET in Apps Script > Project settings > Script properties.
// Deploy as a web app: execute as the owner; anyone may call the endpoint, but writes require the server secret.
function doPost(event) {
 const reply=value=>ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
 let body;try{body=JSON.parse(event.postData.contents)}catch{return reply({saved:false})}
 if(!body||typeof body!=='object')return reply({saved:false});
 const properties=PropertiesService.getScriptProperties();
 const secret=properties.getProperty('LEADS_WEBHOOK_SECRET');
 if(!secret||secret.length<32||body.secret!==secret)return reply({saved:false});
 const name=typeof body.name==='string'?body.name.trim():'';
 if(!/^[a-f0-9-]{36}$/i.test(body.id||'')||!Number.isSafeInteger(body.revision)||body.revision<=0||!name||name.length>80||/[\u0000-\u001f]/.test(name)||!/^\d{9,15}$/.test(body.phone||''))return reply({saved:false});
 const lock=LockService.getScriptLock();
 try{
  lock.waitLock(10000);
  const book=SpreadsheetApp.openById(properties.getProperty('SPREADSHEET_ID'));
  let sheet=book.getSheetByName('Contactos');
  if(!sheet)sheet=book.insertSheet('Contactos');
  if(!sheet.getLastRow()){
   sheet.appendRow(['ID','Nombre','Celular','Fecha (Perú)','Hora (Perú)','Última actualización (Perú)','Clic en WhatsApp','Revisión']);
   sheet.setFrozenRows(1);
   sheet.getRange(1,1,1,8).setFontWeight('bold');
  }
  const lastRow=sheet.getLastRow();
  const match=lastRow>1?sheet.getRange(2,1,lastRow-1,1).createTextFinder(body.id).matchEntireCell(true).findNext():null;
  const row=match?match.getRow():lastRow+1;
  const old=match?sheet.getRange(row,1,1,8).getValues()[0]:null;
  if(old&&Number(old[7])>=body.revision)return reply({saved:true,id:body.id});
  const now=new Date(),zone='America/Lima';
  const safeName=/^[=+\-@]/.test(name)?"'"+name:name;
  const values=[body.id,safeName,body.phone,old?old[3]:Utilities.formatDate(now,zone,'yyyy-MM-dd'),old?old[4]:Utilities.formatDate(now,zone,'HH:mm:ss'),Utilities.formatDate(now,zone,'yyyy-MM-dd HH:mm:ss'),body.whatsappClicked===true||old&&old[6]==='Sí'?'Sí':'No',body.revision];
  sheet.getRange(row,1,1,7).setNumberFormat('@');
  sheet.getRange(row,1,1,8).setValues([values]);
  SpreadsheetApp.flush();
  return reply({saved:true,id:body.id});
 }catch{return reply({saved:false})}
 finally{if(lock.hasLock())lock.releaseLock();}
}
