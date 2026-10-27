import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {handleLeads} from '../server/leads.mjs';
const env={LEADS_WEBHOOK_URL:'https://script.google.com/macros/s/example/exec',LEADS_WEBHOOK_SECRET:'x'.repeat(40)};
const data={id:'12345678-1234-4234-8234-123456789abc',revision:123,name:'María',phone:'+51 987 654 321'};
const request=(body=data,origin='https://factoria-two.vercel.app')=>new Request('https://factoria-two.vercel.app/api/leads',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('configuration exposes only activation and timezone, never credentials',async()=>{
 const response=await handleLeads(new Request('https://factoria-two.vercel.app/api/leads'),env);
 assert.deepEqual(await response.json(),{enabled:true,timeZone:'America/Lima'});
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await (await handleLeads(new Request('https://factoria-two.vercel.app/api/leads'),{})).json(),{enabled:false,timeZone:'America/Lima'});
});
test('valid form saves without a WhatsApp click and credentials stay server-side',async()=>{
 let payload;
 const response=await handleLeads(request(),env,async(url,options)=>{assert.equal(url,env.LEADS_WEBHOOK_URL);payload=JSON.parse(options.body);return Response.json({saved:true,id:data.id})});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{saved:true});
 assert.equal(payload.phone,'51987654321');assert.equal(payload.whatsappClicked,false);assert.equal(payload.secret,env.LEADS_WEBHOOK_SECRET);
});
test('rejects cross-origin requests, malformed data and incomplete phone numbers',async()=>{
 let called=false;const fetcher=async()=>{called=true;throw Error('unexpected')};
 assert.equal((await handleLeads(request(data,'https://other.example'),env,fetcher)).status,403);
 for(const value of [null,{...data,phone:'123'},{...data,name:' '},{...data,revision:-1},{...data,phone:'abc987654321'}])assert.equal((await handleLeads(request(value),env,fetcher)).status,400);
 assert.equal(called,false);
});
test('missing configuration or failed Google writes never claim a successful save',async()=>{
 assert.equal((await handleLeads(request(),{})).status,503);
 assert.equal((await handleLeads(request(),env,async()=>Response.json({saved:false}))).status,502);
 assert.equal((await handleLeads(request(),env,async()=>Response.json({saved:true,id:'wrong'}))).status,502);
});
function element(){return {value:'',listeners:{},hidden:true,addEventListener(name,fn){this.listeners[name]=fn}}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function autosaveFixture(enabled=true){
 const nameInput=element(),phoneInput=element(),dialog=element(),notice=element(),form={querySelector:()=>notice};
 const timers=new Map(),writes=[];let seq=0;
 const document=element(),window=element();
 const context={document,window,crypto:{randomUUID:()=>data.id},sessionStorage:{getItem:()=>null,setItem(){}},Date,Set,JSON,setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq},clearTimeout:key=>timers.delete(key),fetch:async(url,options)=>{if(!options?.method)return Response.json({enabled});writes.push(JSON.parse(options.body));assert.equal(options.keepalive,true);return Response.json({saved:true})}};
 vm.createContext(context);
 vm.runInContext((await readFile('public/lead-autosave.js','utf8')).replace('export function','function')+';globalThis.start=initLeadAutosave;',context);
 const controller=context.start({form,nameInput,phoneInput,dialog});await tick();
 return {nameInput,phoneInput,dialog,notice,writes,controller,window,document,async runTimer(){const item=[...timers].find(([,v])=>v.ms===700);if(item){timers.delete(item[0]);await item[1].fn();await tick();}}};
}
test('typing valid fields autosaves, edits reuse one id, unchanged blurs do not duplicate',async()=>{
 const f=await autosaveFixture();assert.equal(f.notice.hidden,false);
 f.nameInput.value='María';f.phoneInput.value='987654321';f.phoneInput.listeners.input();await f.runTimer();
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].whatsappClicked,false);
 f.nameInput.listeners.blur();await tick();assert.equal(f.writes.length,1);
 f.nameInput.value='María Pérez';f.nameInput.listeners.input();await f.runTimer();
 assert.equal(f.writes.length,2);assert.equal(f.writes[0].id,f.writes[1].id);assert(f.writes[1].revision>f.writes[0].revision);
 f.controller.markWhatsApp();await tick();assert.equal(f.writes.at(-1).whatsappClicked,true);
});
test('incomplete fields and disabled configuration produce no lead writes',async()=>{
 const f=await autosaveFixture();f.nameInput.value='María';f.phoneInput.value='123';f.nameInput.listeners.input();await f.runTimer();assert.equal(f.writes.length,0);
 const disabled=await autosaveFixture(false);disabled.nameInput.value='María';disabled.phoneInput.value='987654321';disabled.phoneInput.listeners.input();await disabled.runTimer();assert.equal(disabled.writes.length,0);assert.equal(disabled.notice.hidden,true);
});
test('leaving the page flushes valid fields before debounce, without clicking WhatsApp',async()=>{
 const f=await autosaveFixture();f.nameInput.value='María';f.phoneInput.value='987654321';f.phoneInput.listeners.input();f.window.listeners.pagehide();await tick();assert.equal(f.writes.length,1);assert.equal(f.writes[0].whatsappClicked,false);
});
test('Apps Script upserts preserve first receipt, reject stale edits and retain WhatsApp status',async()=>{
 const rows=[];let locked=false;
 const range=(row,col)=>({setFontWeight(){},setNumberFormat(){},getValues:()=>[rows[row-1]],setValues:value=>{rows[row-1]=value[0]},createTextFinder:id=>({matchEntireCell(){return this},findNext(){const index=rows.findIndex((r,i)=>i>0&&r[0]===id);return index<0?null:{getRow:()=>index+1}}})});
 const sheet={getLastRow:()=>rows.length,appendRow:row=>rows.push(row),setFrozenRows(){},getRange:range};
 const context={ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})},PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='SPREADSHEET_ID'?'sheet':env.LEADS_WEBHOOK_SECRET})},LockService:{getScriptLock:()=>({waitLock(){locked=true},hasLock:()=>locked,releaseLock(){locked=false}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},Utilities:{formatDate:(_,zone,format)=>{assert.equal(zone,'America/Lima');return format}},Date};
 vm.createContext(context);vm.runInContext(await readFile('integrations/google-sheets/Code.gs','utf8'),context);
 const post=body=>context.doPost({postData:{contents:JSON.stringify(body)}});
 assert.equal(post({...data,phone:'987654321',secret:'wrong'}).saved,false);assert.equal(rows.length,0);
 const base={...data,phone:'987654321',secret:env.LEADS_WEBHOOK_SECRET};assert.equal(post(base).saved,true);assert.equal(rows.length,2);
 const created=rows[1].slice(3,5);assert(created[0] instanceof Date);assert(created[1] instanceof Date);assert(rows[1][5] instanceof Date);
 post({...base,revision:125,name:'=FORMULA()',whatsappClicked:true});assert.equal(rows.length,2);assert.equal(rows[1][1],"'=FORMULA()");assert.deepEqual(rows[1].slice(3,5),created);
 post({...base,revision:124,name:'outdated'});assert.equal(rows[1][1],"'=FORMULA()");
 post({...base,revision:126});assert.equal(rows[1][6],'Sí');assert.equal(locked,false);
});
