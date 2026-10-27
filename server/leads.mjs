const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function configured(env){return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(env.LEADS_WEBHOOK_URL||'')&&typeof env.LEADS_WEBHOOK_SECRET==='string'&&env.LEADS_WEBHOOK_SECRET.length>=32;}
export async function handleLeads(request,env,fetcher=fetch){
 if(request.method==='GET')return json({enabled:configured(env),timeZone:'America/Lima'});
 if(request.method!=='POST')return json({error:'Método no permitido.'},405);
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return json({error:'Solicitud no autorizada.'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato no válido.'},415);
 const raw=await request.text();
 if(raw.length>4096)return json({error:'Solicitud demasiado grande.'},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'Solicitud no válida.'},400)}
 if(!body||typeof body!=='object')return json({error:'Datos no válidos.'},400);
 const name=typeof body.name==='string'?body.name.trim():'';
 const phone=typeof body.phone==='string'?body.phone.replace(/\D/g,''):'';
 if(!/^[a-f0-9-]{36}$/i.test(body.id||'')||!Number.isSafeInteger(body.revision)||body.revision<=0||!name||name.length>80||/[\u0000-\u001f]/.test(name)||!/^\d{9,15}$/.test(phone)||!/^\+?[0-9()\s.-]+$/.test(body.phone||''))return json({error:'Datos no válidos.'},400);
 if(!configured(env))return json({error:'Guardado no disponible.'},503);
 try{
  const response=await fetcher(env.LEADS_WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.LEADS_WEBHOOK_SECRET,id:body.id,revision:body.revision,name,phone,whatsappClicked:body.whatsappClicked===true}),signal:AbortSignal.timeout(12000)});
  const result=await response.json();
  if(!response.ok||result.saved!==true||result.id!==body.id)throw Error('save_failed');
  return json({saved:true});
 }catch{return json({error:'No se pudo guardar en este momento.'},502);}
}
