import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleApi,verifySignature,COURSE,ORDER_BUMP} from '../server/commerce.mjs';

const env={SITE_URL:'https://example.com',STRIPE_SECRET_KEY:'sk_test_example',STRIPE_PUBLISHABLE_KEY:'pk_test_example',STRIPE_WEBHOOK_SECRET:'whsec_example',META_PIXEL_ID:'12345',META_ACCESS_TOKEN:'test-token',META_GRAPH_VERSION:'v23.0',META_TEST_EVENT_CODE:'TEST123'};
const baseSession={id:'cs_test_abcdefghijklm',mode:'payment',status:'complete',payment_status:'paid',amount_total:5000,currency:'pen',livemode:true,metadata:{course_id:COURSE.id,event_date:'2026-10-28',order_bump:'false',marketing_consent:'true'},customer_details:{name:'Jorge Example',email:'Person@example.com'},custom_fields:[{key:'city_province',text:{value:'Lima'}}]};
const bumpSession={...baseSession,amount_total:6900,metadata:{...baseSession.metadata,order_bump:'true'}};
const fakeResponse=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
const req=body=>new Request('https://example.com/api/checkout',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify(body)});
const never=()=>{throw Error('Must not call external service')};
function webhook(session=baseSession,type='checkout.session.completed'){
 const payload=JSON.stringify({type,livemode:true,created:Math.floor(Date.now()/1000),data:{object:session}});const t=Math.floor(Date.now()/1000);const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(t+'.'+payload).digest('hex');
 return new Request('https://example.com/api/stripe-webhook',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${signature}`},body:payload});
}

test('public config is PEN, S/50 base, S/19 bump and 28 October Peru schedule',async()=>{
 const data=await (await handleApi(new Request('https://example.com/api/config'),env,never)).json();
 assert.equal(data.checkoutEnabled,true);assert.equal(data.course.amount,50);assert.equal(data.course.currency,'PEN');assert.equal(data.orderBump.amount,19);assert.equal(data.orderBump.currency,'PEN');assert.equal(data.whatsappUrl,'https://chat.whatsapp.com/CFCV2SkykSOGxlmUVtsIYg');assert.equal(data.eventDateISO,'2026-10-28');assert.equal(data.eventTime,'7:00 p. m. a 10:00 p. m.');assert.equal(data.STRIPE_SECRET_KEY,undefined);assert.equal(data.META_ACCESS_TOKEN,undefined);
});

test('checkout without bump creates one PEN item for S/50 and preserves attribution metadata',async()=>{
 let params;const r=await handleApi(req({requestId:'abcdefghijklmnopqrstuvwx',consent:true,orderBump:false,utm_source:'meta',utm_campaign:'octubre'}),env,async(url,o)=>{assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');params=new URLSearchParams(o.body);return fakeResponse({client_secret:'secret',id:baseSession.id})});
 assert.equal(r.status,200);assert.equal(params.get('line_items[0][price_data][currency]'),'pen');assert.equal(params.get('line_items[0][price_data][unit_amount]'),'5000');assert.equal(params.get('line_items[1][price_data][unit_amount]'),null);assert.equal(params.get('metadata[order_bump]'),'false');assert.equal(params.get('metadata[event_date]'),'2026-10-28');assert.equal(params.get('metadata[utm_source]'),'meta');assert.equal(params.get('metadata[utm_campaign]'),'octubre');assert.equal(params.get('custom_fields[0][key]'),'city_province');assert.equal(params.get('custom_fields[0][label][custom]'),'Ciudad / provincia');
});

test('checkout with bump creates S/50 + S/19 items for S/69 and identifies bump',async()=>{
 let params;const r=await handleApi(req({requestId:'abcdefghijklmnopqrstuvwx',consent:false,orderBump:true}),env,async(url,o)=>{params=new URLSearchParams(o.body);return fakeResponse({client_secret:'secret',id:bumpSession.id})});
 assert.equal(r.status,200);assert.equal(params.get('line_items[0][price_data][unit_amount]'),'5000');assert.equal(params.get('line_items[1][price_data][unit_amount]'),'1900');assert.equal(params.get('line_items[1][price_data][currency]'),'pen');assert.equal(params.get('line_items[1][price_data][product_data][name]'),ORDER_BUMP.name);assert.equal(params.get('metadata[order_bump]'),'true');assert.equal(params.get('payment_intent_data[metadata][order_bump]'),'true');
});

test('checkout rejects foreign origin',async()=>{
 const r=await handleApi(new Request('https://example.com/api/checkout',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({requestId:'abcdefghijklmnopqrstuvwx'})}),env,never);assert.equal(r.status,403);
});

test('session reports actual Stripe amount and bump choice',async()=>{
 for(const [session,value,bump] of [[baseSession,50,false],[bumpSession,69,true]]){const r=await handleApi(new Request('https://example.com/api/session?session_id='+session.id),env,async()=>fakeResponse(session));const data=await r.json();assert.equal(data.paid,true);assert.equal(data.value,value);assert.equal(data.currency,'PEN');assert.equal(data.orderBump,bump);assert.equal(data.eventId,'purchase_'+session.id);assert.equal(data.customer_details,undefined)}
});

test('CAPI Purchase uses real PEN amount and deterministic event id',async()=>{
 const sent=[];const fetcher=async(url,o)=>{assert.match(url,/graph.facebook.com/);sent.push(JSON.parse(o.body));return fakeResponse({events_received:1})};
 assert.equal((await handleApi(webhook(baseSession),env,fetcher)).status,200);assert.equal((await handleApi(webhook(bumpSession),env,fetcher)).status,200);
 assert.equal(sent[0].data[0].custom_data.currency,'PEN');assert.equal(sent[0].data[0].custom_data.value,50);assert.equal(sent[0].data[0].custom_data.num_items,1);assert.equal(sent[0].data[0].event_id,'purchase_'+baseSession.id);assert.equal(sent[1].data[0].custom_data.value,69);assert.equal(sent[1].data[0].custom_data.num_items,2);assert.match(sent[0].data[0].user_data.em[0],/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(sent).includes('Person@'),false);
});

test('raw webhook signature rejects invalid or stale payload and accepts valid one',async()=>{
 const raw='{"test":true}',t=Math.floor(Date.now()/1000);const sig=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(t+'.'+raw).digest('hex');assert.equal(await verifySignature(raw,`t=${t},v1=${sig}`,env.STRIPE_WEBHOOK_SECRET),true);assert.equal(await verifySignature(raw+' ',`t=${t},v1=${sig}`,env.STRIPE_WEBHOOK_SECRET),false);assert.equal(await verifySignature(raw,`t=${t},v1=${sig}`,env.STRIPE_WEBHOOK_SECRET,Date.now()+400000),false);
});

test('recent activity exposes only first name and province from real live current-event sessions',async()=>{
 const live={...env,STRIPE_SECRET_KEY:'sk_live_example',STRIPE_PUBLISHABLE_KEY:'pk_live_example'};const current={...baseSession,livemode:true};const otherDate={...baseSession,id:'cs_live_other123456',metadata:{...baseSession.metadata,event_date:'2026-10-01'},customer_details:{name:'Ana Other',email:'ana@example.com'},custom_fields:[{key:'city_province',text:{value:'Arequipa'}}]};
 const r=await handleApi(new Request('https://example.com/api/recent-activity'),live,async(url)=>{assert.match(url,/checkout\/sessions\?limit=100&status=complete$/);return fakeResponse({data:[current,otherDate]})});const data=await r.json();assert.deepEqual(data.purchases,[{firstName:'Jorge',province:'Lima'}]);assert.equal(JSON.stringify(data).includes('@'),false);assert.equal(JSON.stringify(data).includes(baseSession.id),false);
});

test('recent activity falls back to previous workshop and never fabricates names',async()=>{
 const live={...env,STRIPE_SECRET_KEY:'sk_live_example',STRIPE_PUBLISHABLE_KEY:'pk_live_example'};const previous={...baseSession,id:'cs_live_prev123456',metadata:{...baseSession.metadata,event_date:'2026-10-01'},customer_details:{name:'Ana María',email:'ana@example.com'},custom_fields:[{key:'city_province',text:{value:'Cusco'}}]};const r=await handleApi(new Request('https://example.com/api/recent-activity'),live,async()=>fakeResponse({data:[previous]}));const data=await r.json();assert.deepEqual(data.purchases,[{firstName:'Ana',province:'Cusco'}]);const empty=await (await handleApi(new Request('https://example.com/api/recent-activity'),live,async()=>fakeResponse({data:[]}))).json();assert.deepEqual(empty.purchases,[]);
});

test('pasarela config isolates November 12 schedule and S/50 from the original offer',async()=>{
 const data=await (await handleApi(new Request('https://example.com/api/config?event=pasarela'),{...env,EVENT_DAY:'5',COURSE_PRICE_PEN:'99'},never)).json();
 assert.equal(data.eventDateISO,'2026-11-12');assert.equal(data.eventDate,'jueves 12 de noviembre de 2026');assert.equal(data.eventStartsAt,'2026-11-12T19:00:00-05:00');assert.equal(data.course.amount,50);
 const original=await (await handleApi(new Request('https://example.com/api/config'),env,never)).json();assert.equal(original.eventDateISO,'2026-10-28');
});

test('pasarela creates embedded Stripe checkout for S/50 and preserves conversion metadata',async()=>{
 let params;const response=await handleApi(new Request('https://example.com/api/checkout-pasarela',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({requestId:'abcdefghijklmnopqrstuvwx',consent:true,orderBump:true,utm_source:'meta',fbc:'fb.1.123456.abc'})}),env,async(url,o)=>{params=new URLSearchParams(o.body);return fakeResponse({id:baseSession.id,client_secret:'cs_test_secret'})});
 const data=await response.json();assert.equal(response.status,200);assert.equal(data.clientSecret,'cs_test_secret');assert.equal(params.get('ui_mode'),'embedded_page');assert.equal(params.get('return_url'),'https://example.com/gracias?event=pasarela&session_id={CHECKOUT_SESSION_ID}');assert.equal(params.get('success_url'),null);assert.equal(params.get('line_items[0][price_data][unit_amount]'),'5000');assert.equal(params.get('line_items[1][quantity]'),null);assert.equal(params.get('metadata[event_date]'),'2026-11-12');assert.equal(params.get('metadata[order_bump]'),'false');assert.equal(params.get('metadata[landing_page]'),'pasarela');assert.equal(params.get('metadata[utm_source]'),'meta');assert.equal(params.get('metadata[fbc]'),'fb.1.123456.abc');
});

test('pasarela confirmed payment preserves Purchase deduplication and landing source',async()=>{
 let payload;const session={...baseSession,metadata:{...baseSession.metadata,event_date:'2026-11-12',landing_page:'pasarela'}};
 const response=await handleApi(webhook(session),env,async(url,o)=>{payload=JSON.parse(o.body);return fakeResponse({events_received:1})});
 assert.equal(response.status,200);assert.equal(payload.data[0].event_source_url,'https://example.com/pasarela/checkout');assert.equal(payload.data[0].event_id,'purchase_'+session.id);assert.equal(payload.data[0].custom_data.value,50);
});
