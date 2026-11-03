import './showcase.js?v=showcase-5';
import {configuration,consentAllowed,attribution,track,enablePixel} from './app.js';
const $=id=>document.getElementById(id),form=$('reto-buyer-form'),loading=$('checkout-loading'),error=$('checkout-error'),payButton=$('reto-continue');
let stripe=null,config=null,actions=null,contactElement=null,paymentElement=null,checkoutSessionId=null,checkoutSecret=null,generation=0,confirming=false;
let syncing=false,syncedOptions=null; 
let leadTimer=null,checkoutEmail='',lastSavedLead='';
const DURATION=110*60*1000;
const deadline=Date.now()+DURATION;
let sessionRefreshAt=0;
const selected=()=>({recordings:$('reto-recordings').checked,personalCall:$('reto-call').checked});
const amount=()=>5+(selected().recordings?7:0)+(selected().personalCall?25:0);
function updateTotal(){$('reto-total').textContent='US$'+amount();$('reto-recordings-line').hidden=!selected().recordings;$('reto-call-line').hidden=!selected().personalCall;payButton.textContent='QUIERO MI LUGAR — PAGAR US$'+amount()}
const optionsKey=options=>JSON.stringify(options);
function refreshPayButton(){payButton.disabled=confirming||syncing||!actions||optionsKey(selected())!==syncedOptions||!actions.getSession().canConfirm}
function clearElements(){contactElement?.destroy();paymentElement?.destroy();contactElement=null;paymentElement=null;actions=null;checkoutSessionId=null;checkoutSecret=null;checkoutEmail='';lastSavedLead='';$('contact-details-element').replaceChildren();$('payment-element').replaceChildren()}
function whatsappValue(){const country=$('reto-country').value,prefix=country.slice(1),digits=$('reto-whatsapp').value.replace(/\D/g,'');const lengths={'+51':9,'+52':10,'+57':10,'+56':9,'+54':10,'+1':10,'+34':9,'+593':9,'+591':8,'+58':10};const national=digits.startsWith(prefix)&&digits.length===prefix.length+lengths[country]?digits.slice(prefix.length):digits;return national?country+national:''}
function queueLead(){clearTimeout(leadTimer);leadTimer=setTimeout(async()=>{const name=$('reto-name').value.trim().replace(/\s+/g,' '),whatsapp=whatsappValue(),email=checkoutEmail?.trim().toLowerCase()||'';if(!checkoutSessionId||!checkoutSecret||!(name.length>=2||/^\+[1-9]\d{3,14}$/.test(whatsapp)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return;const data={sessionId:checkoutSessionId,clientSecret:checkoutSecret,...(name.length>=2?{name}:{}),...(/^\+[1-9]\d{3,14}$/.test(whatsapp)?{whatsapp}:{}),...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?{email}:{})},key=JSON.stringify(data);if(key===lastSavedLead)return;try{const response=await fetch('/api/curso-lead',{method:'POST',headers:{'Content-Type':'application/json'},body:key});if(!response.ok)throw Error('No se pudieron guardar los datos.');lastSavedLead=key;$('lead-status').textContent='Datos guardados en el panel';$('lead-status').hidden=false}catch{$('lead-status').textContent='Guardando datos…';$('lead-status').hidden=false;leadTimer=setTimeout(queueLead,5000)}},350)}
function renderTimer(){const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60,two=n=>String(n).padStart(2,'0');$('reto-banner-clock').textContent=`${two(h)}:${two(m)}:${two(s)}`;$('reto-checkout-clock').innerHTML=`${two(h)}<span>h</span>${two(m)}<span>m</span>${two(s)}<span>s</span>`}
renderTimer();setInterval(renderTimer,1000);
function loadStripe(){return new Promise((resolve,reject)=>{if(window.Stripe)return resolve();const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar Stripe. Revisa tu conexión e inténtalo de nuevo.'));document.head.append(s)})}
async function mount(){const current=++generation;payButton.disabled=true;loading.hidden=false;error.hidden=true;$('confirm-errors').hidden=true;clearElements();
 try{
  const selectedOptions=selected(),expected=amount()*100;
  let identity;
  const clientSecret=fetch('/api/checkout-curso',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),inline:true,consent:consentAllowed(),...selectedOptions,...attribution()})}).then(async response=>{const data=await response.json();if(!response.ok||!data.clientSecret)throw Error(data.error||'No pudimos iniciar el pago.');identity=data;return data.clientSecret});
  const sdk=stripe.initCheckoutElementsSdk({clientSecret});
  const result=await sdk.loadActions();if(current!==generation)return;
  if(result.type!=='success')throw Error(result.error?.message||'No se pudo iniciar el formulario.');
  const session=result.actions.getSession();
  if(session.currency?.toLowerCase()!=='usd'||session.total?.total?.minorUnitsAmount!==expected)throw Error('El importe no coincide con tu selección. Recarga la página.');
  sessionRefreshAt=Date.now()+23*60*60*1000;actions=result.actions;checkoutSessionId=identity.sessionId;checkoutSecret=identity.clientSecret;
  contactElement=sdk.createContactDetailsElement();contactElement.mount('#contact-details-element');
  paymentElement=sdk.createPaymentElement({layout:{type:'accordion',defaultCollapsed:false,radios:'never'},paymentMethodOrder:['card'],wallets:{applePay:'auto',googlePay:'auto',link:'never'}});paymentElement.mount('#payment-element');
  sdk.on('change',state=>{if(current!==generation)return;if(state.email!==checkoutEmail){checkoutEmail=state.email||'';queueLead()}if(!confirming)refreshPayButton()});
  syncedOptions=optionsKey(selectedOptions);loading.hidden=true;refreshPayButton();if(optionsKey(selected())!==syncedOptions)syncExtras();
  queueLead();
 }catch(e){if(current!==generation)return;loading.hidden=true;error.hidden=false;$('checkout-message').textContent=e.message||'No pudimos abrir el pago.'}
}
async function syncExtras(){
 if(!actions||syncing||confirming)return;
 syncing=true;refreshPayButton();$('extras-status').textContent='Actualizando tu selección…';$('confirm-errors').hidden=true;
 try{
  while(optionsKey(selected())!==syncedOptions){
   const options=selected(),expected=(5+(options.recordings?7:0)+(options.personalCall?25:0))*100;
   const response=await actions.runServerUpdate(async()=>{
    const r=await fetch('/api/curso-extras',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:checkoutSessionId,clientSecret:checkoutSecret,...options})});
    const data=await r.json();if(!r.ok||!data.updated)throw Error(data.error||'No pudimos actualizar los extras.');
   });
   if(response.type==='error')throw Error(response.error?.message||'No pudimos actualizar los extras.');
   if(actions.getSession().total?.total?.minorUnitsAmount!==expected)throw Error('El importe no coincide. Vuelve a intentar.');
   syncedOptions=optionsKey(options);
  }
  $('extras-status').textContent='Selección actualizada';
 }catch(e){$('extras-status').textContent='No se pudo actualizar. Cambia tu selección para reintentar.';$('confirm-errors').textContent=e.message;$('confirm-errors').hidden=false}
 finally{syncing=false;refreshPayButton();queueLead()}
}
async function start(){try{const [c]=await Promise.all([configuration,loadStripe()]);config=c;if(!c.checkoutEnabled||!c.publishableKey)throw Error('Las inscripciones online no están disponibles en este momento.');$('test-mode').hidden=!c.testMode;stripe=window.Stripe(c.publishableKey);await mount()}catch(e){loading.hidden=true;error.hidden=false;$('checkout-message').textContent=e.message||'No pudimos abrir el pago.'}}
form.addEventListener('submit',async e=>{e.preventDefault();if(!actions||confirming||syncing||optionsKey(selected())!==syncedOptions)return;const name=$('reto-name').value.trim().replace(/\s+/g,' '),whatsapp=whatsappValue();if(name.split(' ').length<2){$('reto-name').setCustomValidity('Escribe tu nombre y apellido.');$('reto-name').reportValidity();return}if(!/^\+[1-9]\d{7,14}$/.test(whatsapp)){$('reto-whatsapp').setCustomValidity('Escribe un número de WhatsApp válido.');$('reto-whatsapp').reportValidity();return}confirming=true;for(const id of ['reto-recordings','reto-call'])$(id).disabled=true;payButton.disabled=true;$('confirm-errors').hidden=true;
 try{const options=selected(),v=amount();const buyer=await fetch('/api/curso-buyer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:checkoutSessionId,clientSecret:checkoutSecret,name,whatsapp,email:checkoutEmail,...options})});const data=await buyer.json();if(!buyer.ok||!data.updated)throw Error(data.error||'No se pudieron guardar tus datos.');await track('InitiateCheckout',{content_ids:[config.course.id],content_type:'product',content_name:config.course.name,currency:'USD',value:v,num_items:1+Number(options.recordings)+Number(options.personalCall)},'checkout_'+crypto.randomUUID());const response=await actions.confirm();if(response.type==='error')throw Error(response.error.message||'No se pudo completar el pago.');}
 catch(err){$('confirm-errors').textContent=err.message||'Revisa tus datos e inténtalo de nuevo.';$('confirm-errors').hidden=false;payButton.disabled=false}finally{confirming=false;for(const id of ['reto-recordings','reto-call'])$(id).disabled=false;refreshPayButton()}
});
for(const input of [$('reto-name'),$('reto-whatsapp')])input.addEventListener('input',()=>{input.setCustomValidity('');queueLead()});
 $('reto-country').addEventListener('change',queueLead);
for(const checkbox of [$('reto-recordings'),$('reto-call')])checkbox.addEventListener('change',()=>{updateTotal();syncExtras();queueLead()});
$('retry-checkout').addEventListener('click',()=>stripe?mount():start());
document.querySelectorAll('[data-checkout-cta]').forEach(button=>button.addEventListener('click',()=>{$('inscripcion').scrollIntoView({behavior:'smooth',block:'start'})}));
function recentTime(created){if(!created)return 'compra confirmada';const hours=Math.floor((Date.now()/1000-created)/3600);if(hours>=0&&hours<24)return hours<1?'hace menos de 1 hora':`hace ${hours} ${hours===1?'hora':'horas'}`;return 'compra confirmada'}
async function purchaseToasts(){try{const r=await fetch('/api/recent-activity?event=curso',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),items=(data.purchases||[]).filter(p=>p.firstName&&['reto','taller'].includes(p.product));if(!items.length)return;const toast=$('reto-purchase-toast');let index=0,closed=false;const show=()=>{if(closed||index>=Math.min(items.length,4))return;const p=items[index++];$('reto-toast-title').textContent=`${p.firstName} se inscribió ${p.product==='reto'?'al reto':'a un taller de IA'}${p.recordings?' + grabaciones':''}`;$('reto-toast-subtitle').textContent=[p.province,recentTime(p.created)].filter(Boolean).join(' · ');$('reto-avatar').textContent=p.firstName[0].toUpperCase();toast.hidden=false;setTimeout(()=>toast.hidden=true,5500);if(index<Math.min(items.length,4))setTimeout(show,28000)};$('reto-toast-close').addEventListener('click',()=>{closed=true;toast.hidden=true});setTimeout(show,7000)}catch{}}
updateTotal();start();enablePixel();purchaseToasts();

// Stripe sessions are renewed independently of the display timer.
setInterval(()=>{if(stripe&&!confirming&&!syncing&&sessionRefreshAt&&Date.now()>=sessionRefreshAt){sessionRefreshAt=0;mount()}},60000);
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload()});
