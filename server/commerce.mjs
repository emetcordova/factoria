export const COURSE = { id: 'emet-contenido-ia-2026-10-01', name: 'Taller en vivo IA', amount: 5000, currency: 'pen' };
export const RETO = { id: 'emet-reto-contenido-ia-2026-11-10', name: 'Reto de contenido con IA · 16, 17 y 18 de noviembre', amount: 500, currency: 'usd' };
export const RETO_RECORDINGS = { name: 'Grabaciones de las 3 sesiones del reto', amount: 700 };
export const RETO_CALL = { name: 'Llamada personalizada de 30 minutos', amount: 2500 };
export const ORDER_BUMP = { id: 'grabacion-soporte-certificado', name: 'Aula virtual 1 año + comunidad + curso de Marketing Digital + soporte + grabación', amount: 1900, currency: 'pen' };
const API_VERSION = '2026-08-26.dahlia';
import defaults from '../public/site-settings.json' with {type: 'json'};
function whatsappInvite(value) {
 try {
  const url=new URL(String(value||'').trim());
  const code=url.pathname.match(/^\/([a-zA-Z0-9]+)\/?$/)?.[1];
  return url.protocol==='https:'&&url.hostname==='chat.whatsapp.com'&&code?'https://chat.whatsapp.com/'+code:null;
 } catch { return null; }
}
export function settings(env) {
 const day=Number(env.EVENT_DAY||defaults.event.day), month=Number(env.EVENT_MONTH||defaults.event.month), year=Number(env.EVENT_YEAR||defaults.event.year);
 const dateOnly=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 const parsed=new Date(dateOnly+'T12:00:00Z');
 if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==dateOnly)throw Error('invalid_event_date');
 const date=env.EVENT_DATE||new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(parsed);
 const time=defaults.event.timePeru;
 const startTime=defaults.event.startTime||'19:00';
 const startsAt=/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)?`${dateOnly}T${startTime}:00-05:00`:null;
 const amount=Number(env.COURSE_PRICE_PEN||defaults.pricePEN), bumpAmount=Number(env.ORDER_BUMP_PEN||defaults.orderBumpPEN);
 if(!Number.isFinite(amount)||amount<=0||amount>=100000||Math.abs(amount*100-Math.round(amount*100))>0.00001)throw Error('invalid_course_price');
 if(!Number.isFinite(bumpAmount)||bumpAmount<=0||bumpAmount>=100000||Math.abs(bumpAmount*100-Math.round(bumpAmount*100))>0.00001)throw Error('invalid_order_bump_price');
 const whatsapp=whatsappInvite(defaults.whatsappGroupUrl);
 const availableSeats=Number(env.AVAILABLE_SEATS||defaults.availableSeats||0);
 if(!Number.isInteger(availableSeats)||availableSeats<0||availableSeats>999)throw Error('invalid_available_seats');
 return {date,time,startsAt,dateOnly,whatsapp,availableSeats,course:{...COURSE,amount:Math.round(amount*100)},orderBump:{...ORDER_BUMP,amount:Math.round(bumpAmount*100)}};
}
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const clean = (v, max=250) => typeof v === 'string' ? v.slice(0,max) : '';
function origin(request) { const u = new URL(request.url); return u.protocol === 'https:' ? u.origin : null; }
function ready(env) { return Boolean( /^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||'') && /^pk_(test|live)_/.test(env.STRIPE_PUBLISHABLE_KEY||'') && env.STRIPE_SECRET_KEY.split('_')[1] === env.STRIPE_PUBLISHABLE_KEY.split('_')[1]); }
async function stripe(path,env,fetcher,options={}) {
 const response = await fetcher('https://api.stripe.com/v1/'+path,{...options,headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY,'Stripe-Version':API_VERSION,...options.headers}});
 const data = await response.json();
 if(!response.ok) throw new Error('stripe_request_failed');
 return data;
}
export async function verifySignature(raw,header,secret,now=Date.now()) {
 if(!secret || !header) return false;
 const entries=header.split(',').map(x=>x.split('='));
 const t=entries.find(x=>x[0]==='t')?.[1];
 if(!/^\d+$/.test(t||'') || Math.abs(now/1000-Number(t))>300) return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 for(const [name,sig] of entries) {
  if(name!=='v1' || !/^[0-9a-f]{64}$/i.test(sig))continue;
  const bytes=Uint8Array.from(sig.match(/../g),x=>parseInt(x,16));
  if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(t+'.'+raw)))return true;
 }
 return false;
}
async function sha256(value) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
const hasOrderBump=s=>s?.metadata?.order_bump==='true';
const retoOptions=s=>({recordings:s?.metadata?.recordings==='true',personalCall:s?.metadata?.personal_call==='true'});
const retoItemCount=s=>{const {recordings,personalCall}=retoOptions(s);return 1+Number(recordings)+Number(personalCall)};
const isRetoPurchase=s=>{const {recordings,personalCall}=retoOptions(s);return s?.metadata?.course_id===RETO.id && s.payment_status==='paid' && s.amount_total===RETO.amount+(recordings?RETO_RECORDINGS.amount:0)+(personalCall?RETO_CALL.amount:0) && s.currency===RETO.currency && s.mode==='payment'};
export function isCoursePurchase(s,c=COURSE,b=ORDER_BUMP) {const expected=c.amount+(hasOrderBump(s)?b.amount:0);return s?.metadata?.course_id===c.id && s.payment_status==='paid' && s.amount_total===expected && s.currency===c.currency && s.mode==='payment';}
export async function sendPurchase(s,event,env,fetcher,c=COURSE,b=ORDER_BUMP,siteOrigin) {
 if(s.metadata.marketing_consent!=='true')return 'no_consent';
 if(!env.META_ACCESS_TOKEN)return 'not_configured';
 if(!/^\d+$/.test(env.META_PIXEL_ID||'') || !env.META_ACCESS_TOKEN || !/^v\d+\.\d+$/.test(env.META_GRAPH_VERSION||''))throw Error('meta_not_configured');
 if(!event.livemode && !env.META_TEST_EVENT_CODE)return 'test_payment';
 const user={};
 const email=s.customer_details?.email?.trim().toLowerCase();
 if(email)user.em=[await sha256(email)];
 for(const name of ['fbp','fbc'])if(s.metadata[name])user[name]=s.metadata[name];
 if(s.metadata.client_user_agent)user.client_user_agent=s.metadata.client_user_agent;
 const payload={data:[{event_name:'Purchase',event_time:event.created,event_id:'purchase_'+s.id,action_source:'website',event_source_url:siteOrigin+(s.metadata.landing_page==='curso'?'/curso':s.metadata.landing_page==='pasarela'?'/pasarela/checkout':'/checkout'),user_data:user,custom_data:{currency:c.currency.toUpperCase(),value:s.amount_total/100,content_ids:[c.id],content_type:'product',num_items:c.id===RETO.id?retoItemCount(s):hasOrderBump(s)?2:1}}]};
 if(env.META_TEST_EVENT_CODE)payload.test_event_code=env.META_TEST_EVENT_CODE;
 const r=await fetcher(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PIXEL_ID}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.META_ACCESS_TOKEN},body:JSON.stringify(payload)});
 if(!r.ok)throw Error('meta_delivery_failed');
 const result=await r.json();if(result.events_received!==1)throw Error('meta_not_accepted');
 return 'sent';
}
function customField(session,key){const field=(session?.custom_fields||[]).find(item=>item?.key===key);return clean(field?.text?.value||field?.dropdown?.value||'',60).trim();}
function firstName(value){return clean(value,80).trim().split(/\s+/)[0]||'';}
export async function handleApi(request,env,fetcher=fetch) {
 const u=new URL(request.url), path=u.pathname, siteOrigin=origin(request);
 const analyticsId=env.GOOGLE_ANALYTICS_ID===undefined?'G-ZCY5PSC64X':env.GOOGLE_ANALYTICS_ID;
 try {
  const reto=path==='/api/checkout-curso'||(path==='/api/config'&&u.searchParams.get('event')==='curso');
  const pasarela=path==='/api/checkout-pasarela'||(path==='/api/config'&&u.searchParams.get('event')==='pasarela');
  const cfg=settings(pasarela?{...env,EVENT_DAY:'12',EVENT_MONTH:'11',EVENT_YEAR:'2026',EVENT_DATE:'jueves 12 de noviembre de 2026',COURSE_PRICE_PEN:'50'}:env), c=cfg.course, bump=cfg.orderBump;
  if(path==='/api/config' && request.method==='GET'&&reto)return json({checkoutEnabled:ready(env)&&Boolean(siteOrigin),publishableKey:ready(env)&&siteOrigin?env.STRIPE_PUBLISHABLE_KEY:null,pixelId:/^\d+$/.test(env.META_PIXEL_ID||'')?env.META_PIXEL_ID:null,googleAnalyticsId:/^G-[A-Z0-9]+$/.test(analyticsId)?analyticsId:null,tiktokPixelId:/^[A-Z0-9]{10,24}$/.test(env.TIKTOK_PIXEL_ID||'')?env.TIKTOK_PIXEL_ID:null,testMode:!env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),course:{...RETO,amount:5,currency:'USD'},eventDate:'16, 17 y 18 de noviembre de 2026',eventDateISO:'2026-11-16',eventTime:'10:00 a. m. · hora de Perú',whatsappUrl:cfg.whatsapp,availableSeats:0});
  if(path==='/api/config' && request.method==='GET')return json({checkoutEnabled:ready(env)&&Boolean(siteOrigin),publishableKey:ready(env)&&siteOrigin?env.STRIPE_PUBLISHABLE_KEY:null,pixelId:/^\d+$/.test(env.META_PIXEL_ID||'')?env.META_PIXEL_ID:null,googleAnalyticsId:/^G-[A-Z0-9]+$/.test(analyticsId)?analyticsId:null,tiktokPixelId:/^[A-Z0-9]{10,24}$/.test(env.TIKTOK_PIXEL_ID||'')?env.TIKTOK_PIXEL_ID:null,testMode:!env.STRIPE_SECRET_KEY?.startsWith('sk_live_'),course:{...c,amount:c.amount/100,currency:'PEN'},orderBump:{...bump,amount:bump.amount/100,currency:'PEN'},eventDate:cfg.date,eventTime:cfg.time,eventStartsAt:cfg.startsAt,eventDateISO:cfg.dateOnly,whatsappUrl:cfg.whatsapp,availableSeats:cfg.availableSeats});
  if(path==='/api/recent-activity' && request.method==='GET') {
   if(!ready(env)||!env.STRIPE_SECRET_KEY.startsWith('sk_live_'))return json({purchases:[]});
   const sessions=await stripe('checkout/sessions?limit=100&status=complete',env,fetcher);
   if(u.searchParams.get('event')==='curso'){
    const purchases=(sessions.data||[]).filter(s=>s?.payment_status==='paid'&&(isRetoPurchase(s)||isCoursePurchase(s,c,bump))).map(s=>({firstName:firstName(s.metadata?.buyer_name||s.customer_details?.name),province:customField(s,'city_province')||null,product:s.metadata?.course_id===RETO.id?'reto':'taller',recordings:s.metadata?.recordings==='true',created:Number(s.created)||null})).filter(item=>item.firstName).slice(0,8);
    return json({purchases});
   }
   const paid=(sessions.data||[]).filter(s=>s?.metadata?.course_id===c.id&&s.payment_status==='paid'&&s.currency==='pen');
   let eligible=paid.filter(s=>s.metadata?.event_date===cfg.dateOnly);
   if(!eligible.length){const priorDates=[...new Set(paid.map(s=>s.metadata?.event_date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&d<cfg.dateOnly))].sort().reverse();if(priorDates[0])eligible=paid.filter(s=>s.metadata?.event_date===priorDates[0]);}
   const purchases=eligible.map(s=>({firstName:firstName(s.customer_details?.name),province:customField(s,'city_province')})).filter(item=>item.firstName&&item.province).slice(0,8);
   return json({purchases});
  }
  if(['/api/checkout','/api/checkout-pasarela','/api/checkout-curso'].includes(path) && request.method==='POST') {
   if(!ready(env)||!siteOrigin)return json({error:'Las inscripciones online todavía no están habilitadas. Escríbenos para coordinar tu acceso.'},503);
   if(request.headers.get('origin')!==siteOrigin)return json({error:'Solicitud no autorizada.'},403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato no válido.'},415);
   const raw=await request.text();if(raw.length>8192)return json({error:'Solicitud demasiado grande.'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Solicitud no válida.'},400)}
   if(!body || typeof body!=='object' || !/^[a-zA-Z0-9-]{20,80}$/.test(body.requestId||''))return json({error:'Recarga la página e inténtalo nuevamente.'},400);
   const addBump=!pasarela&&!reto&&body.orderBump===true;
   if(reto){
    const name=clean(body.name,100).trim(),email=clean(body.email,200).trim().toLowerCase(),phone=clean(body.whatsapp,30).trim();
    if(!body.inline && (name.split(/\s+/).length<2||!/^\S+@\S+\.\S+$/.test(email)||!/^\+[1-9]\d{7,14}$/.test(phone)))return json({error:'Completa tu nombre, correo y WhatsApp para continuar.'},400);
    const recordings=body.recordings===true,personalCall=body.personalCall===true;
    const params=new URLSearchParams({ui_mode:'embedded_page',mode:'payment',locale:'es',return_url:siteOrigin+'/gracias?event=curso&session_id={CHECKOUT_SESSION_ID}',customer_email:email,expires_at:String(Math.floor(Date.now()/1000)+24*60*60), 'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':'500','line_items[0][price_data][product_data][name]':RETO.name,'line_items[0][price_data][product_data][description]':'16, 17 y 18 de noviembre de 2026 · 10:00 a. m. · hora de Perú · En vivo','line_items[0][quantity]':'1','metadata[course_id]':RETO.id,'metadata[event_date]':'2026-11-16','metadata[landing_page]':'curso','metadata[buyer_name]':name,'metadata[whatsapp]':phone,'metadata[recordings]':String(recordings),'metadata[personal_call]':String(personalCall),'metadata[marketing_consent]':String(body.consent===true),'payment_intent_data[metadata][course_id]':RETO.id,'payment_intent_data[metadata][recordings]':String(recordings),'payment_intent_data[metadata][personal_call]':String(personalCall)});
    if(body.inline){params.set('ui_mode','elements');params.delete('customer_email');params.delete('metadata[buyer_name]');params.delete('metadata[whatsapp]');params.set('payment_method_types[0]','card');}
    else if(personalCall)params.set('phone_number_collection[enabled]','true');
    let index=1;for(const [chosen,item] of [[recordings,RETO_RECORDINGS],[personalCall,RETO_CALL]])if(chosen){params.set(`line_items[${index}][price_data][currency]`,'usd');params.set(`line_items[${index}][price_data][unit_amount]`,String(item.amount));params.set(`line_items[${index}][price_data][product_data][name]`,item.name);params.set(`line_items[${index}][quantity]`,'1');index++}
    if(body.consent===true){for(const name of ['fbp','fbc']){const v=clean(body[name]);if(/^fb\.\d+\.\d+\.[a-zA-Z0-9_-]+$/.test(v))params.set('metadata['+name+']',v)}params.set('metadata[client_user_agent]',clean(request.headers.get('user-agent'),450));for(const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(body[name])params.set('metadata['+name+']',clean(body[name],200))}
    const session=await stripe('checkout/sessions',env,fetcher,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'emet-curso-'+body.requestId},body:params.toString()});return json({clientSecret:session.client_secret,sessionId:session.id});
   }
   const params=new URLSearchParams({ui_mode:'embedded_page',mode:'payment',locale:'es',return_url:siteOrigin+'/gracias?session_id={CHECKOUT_SESSION_ID}',
    'line_items[0][price_data][currency]':c.currency,'line_items[0][price_data][unit_amount]':String(c.amount),'line_items[0][price_data][product_data][name]':c.name,'line_items[0][quantity]':'1',
    'metadata[course_id]':c.id,'metadata[event_date]':cfg.dateOnly,'metadata[order_bump]':String(addBump),'metadata[marketing_consent]':String(body.consent===true),'payment_intent_data[metadata][course_id]':c.id,'payment_intent_data[metadata][event_date]':cfg.dateOnly,'payment_intent_data[metadata][order_bump]':String(addBump),
    'custom_fields[0][key]':'city_province','custom_fields[0][label][type]':'custom','custom_fields[0][label][custom]':'Ciudad / provincia','custom_fields[0][type]':'text','custom_fields[0][optional]':'false'});
   if(pasarela){params.set('ui_mode','elements');for(const key of [...params.keys()])if(key.startsWith('custom_fields['))params.delete(key);params.set('return_url',siteOrigin+'/gracias?event=pasarela&session_id={CHECKOUT_SESSION_ID}');params.set('metadata[landing_page]','pasarela');params.set('line_items[0][price_data][product_data][description]','Jueves 12 de noviembre de 2026 · 7:00 p. m. a 10:00 p. m. · Hora de Perú · En vivo por Zoom');}
   if(addBump){params.set('line_items[1][price_data][currency]',bump.currency);params.set('line_items[1][price_data][unit_amount]',String(bump.amount));params.set('line_items[1][price_data][product_data][name]',bump.name);params.set('line_items[1][quantity]','1');params.set('payment_intent_data[metadata][order_bump_name]',bump.name);}
   if(body.consent===true) {
    for(const name of ['fbp','fbc']){const v=clean(body[name]);if(/^fb\.\d+\.\d+\.[a-zA-Z0-9_-]+$/.test(v))params.set('metadata['+name+']',v);}
    params.set('metadata[client_user_agent]',clean(request.headers.get('user-agent'),450));
    for(const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(body[name])params.set('metadata['+name+']',clean(body[name],200));
   }
   const session=await stripe('checkout/sessions',env,fetcher,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'emet-'+body.requestId},body:params.toString()});
   return json({clientSecret:session.client_secret,sessionId:session.id});
  }
  if(path==='/api/curso-extras' && request.method==='POST'){
   if(!ready(env)||!siteOrigin)return json({error:'El pago no está disponible.'},503);
   if(request.headers.get('origin')!==siteOrigin)return json({error:'Solicitud no autorizada.'},403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato no válido.'},415);
   const raw=await request.text();if(raw.length>2048)return json({error:'Solicitud demasiado grande.'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Solicitud no válida.'},400)}
   const id=body?.sessionId;
   if(!/^cs_(test_|live_)?[a-zA-Z0-9]{10,250}$/.test(id||'')||typeof body.recordings!=='boolean'||typeof body.personalCall!=='boolean'||typeof body.clientSecret!=='string'||!body.clientSecret)return json({error:'Selección no válida.'},400);
   const session=await stripe('checkout/sessions/'+encodeURIComponent(id),env,fetcher);
   if(session.metadata?.course_id!==RETO.id||session.status!=='open'||session.ui_mode!=='elements'||session.client_secret!==body.clientSecret)return json({error:'Actualiza el formulario para continuar.'},409);
   const params=new URLSearchParams({'metadata[recordings]':String(body.recordings),'metadata[personal_call]':String(body.personalCall),'payment_intent_data[metadata][recordings]':String(body.recordings),'payment_intent_data[metadata][personal_call]':String(body.personalCall)});
   const items=[RETO,...(body.recordings?[RETO_RECORDINGS]:[]),...(body.personalCall?[RETO_CALL]:[])];
   items.forEach((item,i)=>{params.set(`line_items[${i}][price_data][currency]`,'usd');params.set(`line_items[${i}][price_data][unit_amount]`,String(item.amount));params.set(`line_items[${i}][price_data][product_data][name]`,item.name);params.set(`line_items[${i}][quantity]`,'1')});
   const updated=await stripe('checkout/sessions/'+encodeURIComponent(id),env,fetcher,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
   return json({updated:true,amount:updated.amount_total});
  }
  if(path==='/api/curso-buyer' && request.method==='POST'){
   if(!ready(env)||!siteOrigin)return json({error:'El pago no está disponible.'},503);
   if(request.headers.get('origin')!==siteOrigin)return json({error:'Solicitud no autorizada.'},403);
   if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato no válido.'},415);
   const raw=await request.text();if(raw.length>2048)return json({error:'Solicitud demasiado grande.'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Solicitud no válida.'},400)}
   const id=body?.sessionId,name=clean(body?.name,100).trim(),phone=clean(body?.whatsapp,30).trim();
   if(!/^cs_(test_|live_)?[a-zA-Z0-9]{10,250}$/.test(id||'')||name.split(/\s+/).length<2||!/^\+[1-9]\d{7,14}$/.test(phone))return json({error:'Completa tu nombre y WhatsApp para continuar.'},400);
   const session=await stripe('checkout/sessions/'+encodeURIComponent(id),env,fetcher);
   if(session.metadata?.course_id!==RETO.id||session.status!=='open'||session.client_secret!==body.clientSecret||session.metadata?.recordings!==String(body.recordings===true)||session.metadata?.personal_call!==String(body.personalCall===true))return json({error:'La sesión de pago cambió. Actualiza la página.'},409);
   const params=new URLSearchParams({'metadata[buyer_name]':name,'metadata[whatsapp]':phone});
   await stripe('checkout/sessions/'+encodeURIComponent(id),env,fetcher,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
   return json({updated:true});
  }
  if(path==='/api/session' && request.method==='GET') {
   if(!ready(env)||!siteOrigin)return json({error:'No podemos verificar el pago en este momento.'},503);
   const id=u.searchParams.get('session_id');if(!/^cs_(test_|live_)?[a-zA-Z0-9]{10,250}$/.test(id||''))return json({error:'Referencia de compra no válida.'},400);
   const session=await stripe('checkout/sessions/'+encodeURIComponent(id),env,fetcher);
   const product=session.metadata?.course_id===RETO.id?RETO:c;
   if(session.metadata?.course_id!==product.id)return json({error:'Compra no encontrada.'},404);
   const paid=product===RETO?isRetoPurchase(session):isCoursePurchase(session,c,bump);
   const trackableMode=session.livemode===true||Boolean(env.META_TEST_EVENT_CODE);
   let serverDelivery='not_attempted';
   if(paid&&session.metadata.marketing_consent==='true'&&trackableMode){
    try{serverDelivery=await sendPurchase(session,{created:Number(session.created)||Math.floor(Date.now()/1000),livemode:session.livemode===true},env,fetcher,product,bump,siteOrigin);}catch{serverDelivery='failed';}
   }
   return json({paid,status:session.status,paymentStatus:session.payment_status,value:session.amount_total/100,currency:session.currency?.toUpperCase(),orderBump:hasOrderBump(session),recordings:product===RETO&&retoOptions(session).recordings,personalCall:product===RETO&&retoOptions(session).personalCall,numItems:product===RETO?retoItemCount(session):hasOrderBump(session)?2:1,eventId:'purchase_'+session.id,courseId:product.id,allowTracking:session.metadata.marketing_consent==='true'&&trackableMode,serverDelivery});
  }
  if(path==='/api/stripe-webhook' && request.method==='POST') {
   if(!env.STRIPE_WEBHOOK_SECRET)return json({error:'Webhook no configurado.'},503);
   const raw=await request.text();if(raw.length>1000000)return json({error:'Payload too large'},413);
   if(!await verifySignature(raw,request.headers.get('stripe-signature'),env.STRIPE_WEBHOOK_SECRET))return json({error:'Invalid signature.'},400);
   const event=JSON.parse(raw);
   if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type) && (isCoursePurchase(event.data?.object,c,bump)||isRetoPurchase(event.data?.object))) {
    const product=event.data.object.metadata.course_id===RETO.id?RETO:c;const delivery=await sendPurchase(event.data.object,event,env,fetcher,product,bump,siteOrigin);return json({received:true,delivery});
   }
   return json({received:true});
  }
  return json({error:'Ruta no encontrada.'},404);
 } catch(error) { const safeErrors=['invalid_event_date','invalid_course_price','invalid_order_bump_price','invalid_whatsapp_url','invalid_available_seats']; if(path==='/api/config' && safeErrors.includes(error.message))return json({error:error.message},502); return json({error:'No pudimos completar la solicitud. Inténtalo nuevamente en unos minutos.'},502); }
}
