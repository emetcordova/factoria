import {get,put} from '@vercel/blob';

const CONFIG='crm/integrations/botcake.json';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const opts=env=>({access:'private',token:env.BLOB_READ_WRITE_TOKEN});
const clean=(v,max=200)=>String(v||'').trim().slice(0,max);
async function read(path,env){const r=await get(path,{...opts(env),useCache:false});return r?{data:await new Response(r.stream).json(),etag:r.blob.etag}:null}
async function write(path,data,env,etag){return put(path,JSON.stringify(data),{...opts(env),contentType:'application/json',allowOverwrite:true,...(etag?{ifMatch:etag}:{})})}
async function key(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.CRM_SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
async function encrypt(secret,env){const iv=crypto.getRandomValues(new Uint8Array(12)),bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(secret));return {iv:Buffer.from(iv).toString('base64'),value:Buffer.from(bytes).toString('base64')}}
async function decrypt(data,env){if(!data?.iv||!data?.value)return '';const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(data.iv,'base64')},await key(env),Buffer.from(data.value,'base64'));return new TextDecoder().decode(bytes)}
export async function getBotcakeConfig(env){const item=await read(CONFIG,env);if(!item)return null;return {...item.data,apiKey:await decrypt(item.data.encryptedKey,env)}}
export async function saveBotcakeConfig(env,input){const old=await read(CONFIG,env),previous=old?.data||{};const apiKey=clean(input.apiKey,500),pageId=clean(input.pageId,100),flowId=clean(input.flows?.coursePaid,40),testPhone=clean(input.testPhone,40);
 if(!/^[\w-]{3,100}$/.test(pageId)||!/^[1-9]\d*$/.test(flowId)||!normalizePhone(testPhone))throw Error('Completa Page ID, Flow ID numérico y WhatsApp de prueba.');
 if(!apiKey&&!previous.encryptedKey)throw Error('Ingresa la API Key de Botcake.');
 const data={pageId,flows:{...previous.flows,coursePaid:flowId},testPhone,encryptedKey:apiKey?await encrypt(apiKey,env):previous.encryptedKey};
 await write(CONFIG,data,env,old?.etag);return {pageId,flows:data.flows,testPhone,hasApiKey:true}
}
export function normalizePhone(value){let digits=String(value||'').replace(/\D/g,'');if(digits.startsWith('00'))digits=digits.slice(2);if(!/^[1-9]\d{7,14}$/.test(digits))return null;return digits}
export async function sendBotcakeFlow({phone,flowId,customer,config,fetcher=fetch}){const digits=normalizePhone(phone);if(!digits)throw Error('WhatsApp inválido');if(!config?.apiKey||!config?.pageId||!flowId)throw Error('Integración Botcake incompleta');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{const response=await fetcher('https://botcake.io/api/public_api/v1/pages/'+encodeURIComponent(config.pageId)+'/flows/send_flow',{method:'POST',headers:{'access-token':config.apiKey,'Content-Type':'application/json'},body:JSON.stringify({psid:'wa_'+digits,flow_id:Number(flowId),payload:{user_full_name:clean(customer?.name,100),email:clean(customer?.email,200),phone:'+'+digits}}),signal:controller.signal});const body=await response.json().catch(()=>({}));if(!response.ok||body.success!==true)throw Error(clean(body.message||body.error||body.msg||'Botcake respondió HTTP '+response.status,400));return {messageId:clean(body.data?.message_id||body.message_id,100)||null,response:{success:true,messageId:body.data?.message_id||body.message_id||null}}}finally{clearTimeout(timer)}
}
const deliveryPath=id=>'crm/delivery/'+id+'.json';
async function log(env,entry){await put('crm/botcake-logs/'+entry.purchaseId+'/'+Date.now()+'-'+crypto.randomUUID()+'.json',JSON.stringify(entry),{...opts(env),contentType:'application/json'})}
export async function deliverPaidCourse(env,customer,{force=false,fetcher=fetch}={}){
 const purchaseId=customer.sessionId;if(!customer.paid||!purchaseId||!customer.whatsapp)return {status:'pending'};
 const config=await getBotcakeConfig(env);if(!config?.apiKey||!config.flows?.coursePaid)return {status:'pending'};
 const path=deliveryPath(purchaseId),previous=await read(path,env);
 if(previous?.data.status==='sent'&&!force)return {status:'sent',duplicate:true,patch:{whatsappSent:true,whatsappSentAt:previous.data.whatsappSentAt,botcakeStatus:'sent',botcakeError:null,botcakeMessageId:previous.data.botcakeMessageId||null}};
 if(previous?.data.status==='failed'&&!force)return {status:'failed',duplicate:true,patch:{whatsappSent:false,botcakeStatus:'failed',botcakeError:previous.data.botcakeError||'Error anterior de Botcake',botcakeMessageId:null}};
 if(previous?.data.status==='sending'&&!force)return {status:'pending',duplicate:true};
 const claim={status:'sending',startedAt:Date.now(),purchaseId};
 try{await put(path,JSON.stringify(claim),{...opts(env),contentType:'application/json',allowOverwrite:Boolean(previous),...(previous?{ifMatch:previous.etag}:{})})}catch{return {status:'pending',duplicate:true}}
 const base={customerId:purchaseId,purchaseId,phone:normalizePhone(customer.whatsapp),flowId:config.flows.coursePaid,date:new Date().toISOString()};
 try{const result=await sendBotcakeFlow({phone:customer.whatsapp,flowId:config.flows.coursePaid,customer,config,fetcher});const patch={whatsappSent:true,whatsappSentAt:new Date().toISOString(),botcakeStatus:'sent',botcakeError:null,botcakeMessageId:result.messageId};await write(path,{status:'sent',startedAt:claim.startedAt,...patch},env);try{await log(env,{...base,status:'sent',response:result.response})}catch{}return {status:'sent',patch}}
 catch(error){const detail=clean(error.message,400);const patch={whatsappSent:false,botcakeStatus:'failed',botcakeError:detail,botcakeMessageId:null};await write(path,{status:'failed',startedAt:claim.startedAt,...patch},env);try{await log(env,{...base,status:'failed',response:detail})}catch{}return {status:'failed',patch}}
}
export async function botcakeSettings(request,env){if(request.method==='GET'){const c=await getBotcakeConfig(env);return json(c?{pageId:c.pageId,flows:c.flows,testPhone:c.testPhone,hasApiKey:Boolean(c.apiKey)}:{pageId:'',flows:{coursePaid:''},testPhone:'',hasApiKey:false})}
 if(request.method==='POST'){try{return json(await saveBotcakeConfig(env,await request.json()))}catch(e){return json({error:e.message},400)}}return json({error:'Método no permitido'},405)}
export async function botcakeTest(request,env){try{const cfg=await getBotcakeConfig(env);if(!cfg?.apiKey||!cfg.pageId||!cfg.flows?.coursePaid)return json({error:'Configura Botcake primero.'},400);const input=await request.json(),phone=clean(input.phone||cfg.testPhone,40);if(input.connectionOnly){const r=await fetch('https://botcake.io/api/public_api/v1/pages/'+encodeURIComponent(cfg.pageId)+'/flows',{headers:{'access-token':cfg.apiKey}});const data=await r.json().catch(()=>({}));if(!r.ok||data.success===false)throw Error(clean(data.message||data.error||'HTTP '+r.status,400));return json({ok:true,message:'Conexión exitosa'})}const result=await sendBotcakeFlow({phone,flowId:cfg.flows.coursePaid,customer:{name:'Prueba Factoria'},config:cfg});return json({ok:true,message:'Mensaje de prueba enviado',messageId:result.messageId})}catch(e){return json({error:'Error de Botcake: '+clean(e.message,400)},502)}}
