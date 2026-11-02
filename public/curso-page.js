import './showcase.js?v=showcase-5';
import {configuration,consentAllowed,attribution,track,enablePixel} from './app.js';
const $=id=>document.getElementById(id),form=$('reto-buyer-form'),loading=$('checkout-loading'),error=$('checkout-error'),payButton=$('reto-continue');
let stripe=null,config=null,actions=null,contactElement=null,paymentElement=null,checkoutSessionId=null,checkoutSecret=null,generation=0,confirming=false;
const DURATION=110*60*1000,timerKey='factoria_reto_checkout_started';
let startedAt;try{startedAt=Number(sessionStorage.getItem(timerKey));if(!Number.isFinite(startedAt)||startedAt>Date.now()||startedAt<=0){startedAt=Date.now();sessionStorage.setItem(timerKey,String(startedAt))}}catch{startedAt=Date.now()}
const deadline=startedAt+DURATION;
const selected=()=>({recordings:$('reto-recordings').checked,personalCall:$('reto-call').checked});
const amount=()=>5+(selected().recordings?7:0)+(selected().personalCall?25:0);
function updateTotal(){$('reto-total').textContent='US$'+amount();$('reto-recordings-line').hidden=!selected().recordings;$('reto-call-line').hidden=!selected().personalCall;payButton.textContent='QUIERO MI LUGAR — PAGAR US$'+amount()}
function clearElements(){contactElement?.destroy();paymentElement?.destroy();contactElement=null;paymentElement=null;actions=null;checkoutSessionId=null;checkoutSecret=null;$('contact-details-element').replaceChildren();$('payment-element').replaceChildren()}
function renderTimer(){const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60,two=n=>String(n).padStart(2,'0');$('reto-banner-clock').textContent=`${two(h)}:${two(m)}:${two(s)}`;$('reto-checkout-clock').innerHTML=`${two(h)}<span>h</span>${two(m)}<span>m</span>${two(s)}<span>s</span>`;if(!seconds){generation++;payButton.disabled=true;payButton.textContent='TIEMPO DE ESTA SESIÓN TERMINADO';clearElements();$('reto-pay-panel').hidden=true;$('reto-checkout-clock').nextElementSibling.textContent='Para comenzar una nueva inscripción, abre la página en una pestaña nueva.'}}
renderTimer();setInterval(renderTimer,1000);
function loadStripe(){return new Promise((resolve,reject)=>{if(window.Stripe)return resolve();const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar Stripe. Revisa tu conexión e inténtalo de nuevo.'));document.head.append(s)})}
async function mount(){if(Date.now()>=deadline)return;const current=++generation;payButton.disabled=true;loading.hidden=false;error.hidden=true;$('confirm-errors').hidden=true;clearElements();
 try{
  const selectedOptions=selected(),expected=amount()*100;
  let identity;
  const clientSecret=fetch('/api/checkout-curso',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),inline:true,consent:consentAllowed(),...selectedOptions,...attribution()})}).then(async response=>{const data=await response.json();if(!response.ok||!data.clientSecret)throw Error(data.error||'No pudimos iniciar el pago.');identity=data;return data.clientSecret});
  const sdk=stripe.initCheckoutElementsSdk({clientSecret});
  const result=await sdk.loadActions();if(current!==generation||Date.now()>=deadline)return;
  if(result.type!=='success')throw Error(result.error?.message||'No se pudo iniciar el formulario.');
  const session=result.actions.getSession();
  if(session.currency?.toLowerCase()!=='usd'||session.total?.total?.minorUnitsAmount!==expected)throw Error('El importe no coincide con tu selección. Recarga la página.');
  actions=result.actions;checkoutSessionId=identity.sessionId;checkoutSecret=identity.clientSecret;
  contactElement=sdk.createContactDetailsElement();contactElement.mount('#contact-details-element');
  paymentElement=sdk.createPaymentElement({layout:{type:'accordion',defaultCollapsed:false,radios:'never'},paymentMethodOrder:['card'],wallets:{applePay:'never',googlePay:'never',link:'never'}});paymentElement.mount('#payment-element');
  sdk.on('change',state=>{if(current===generation&&!confirming&&Date.now()<deadline)payButton.disabled=!state.canConfirm});
  payButton.disabled=!session.canConfirm;loading.hidden=true;
 }catch(e){if(current!==generation)return;loading.hidden=true;error.hidden=false;$('checkout-message').textContent=e.message||'No pudimos abrir el pago.'}
}
async function start(){try{const [c]=await Promise.all([configuration,loadStripe()]);config=c;if(!c.checkoutEnabled||!c.publishableKey)throw Error('Las inscripciones online no están disponibles en este momento.');$('test-mode').hidden=!c.testMode;stripe=window.Stripe(c.publishableKey);await mount()}catch(e){loading.hidden=true;error.hidden=false;$('checkout-message').textContent=e.message||'No pudimos abrir el pago.'}}
form.addEventListener('submit',async e=>{e.preventDefault();if(Date.now()>=deadline||!actions||confirming)return;const name=$('reto-name').value.trim().replace(/\s+/g,' '),whatsapp=$('reto-country').value+$('reto-whatsapp').value.replace(/\D/g,'');if(name.split(' ').length<2){$('reto-name').setCustomValidity('Escribe tu nombre y apellido.');$('reto-name').reportValidity();return}if(!/^\+[1-9]\d{7,14}$/.test(whatsapp)){$('reto-whatsapp').setCustomValidity('Escribe un número de WhatsApp válido.');$('reto-whatsapp').reportValidity();return}confirming=true;payButton.disabled=true;$('confirm-errors').hidden=true;
 try{const options=selected(),v=amount();const buyer=await fetch('/api/curso-buyer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:checkoutSessionId,clientSecret:checkoutSecret,name,whatsapp,...options})});const data=await buyer.json();if(!buyer.ok||!data.updated)throw Error(data.error||'No se pudieron guardar tus datos.');await track('InitiateCheckout',{content_ids:[config.course.id],content_type:'product',content_name:config.course.name,currency:'USD',value:v,num_items:1+Number(options.recordings)+Number(options.personalCall)},'checkout_'+crypto.randomUUID());const response=await actions.confirm();if(response.type==='error')throw Error(response.error.message||'No se pudo completar el pago.');}
 catch(err){$('confirm-errors').textContent=err.message||'Revisa tus datos e inténtalo de nuevo.';$('confirm-errors').hidden=false;payButton.disabled=false}finally{confirming=false}
});
for(const input of [$('reto-name'),$('reto-whatsapp')])input.addEventListener('input',()=>input.setCustomValidity(''));
for(const checkbox of [$('reto-recordings'),$('reto-call')])checkbox.addEventListener('change',()=>{updateTotal();if(stripe)mount()});
$('retry-checkout').addEventListener('click',()=>stripe?mount():start());
document.querySelectorAll('[data-checkout-cta]').forEach(button=>button.addEventListener('click',()=>{$('inscripcion').scrollIntoView({behavior:'smooth',block:'start'})}));
function recentTime(created){if(!created)return 'compra confirmada';const hours=Math.floor((Date.now()/1000-created)/3600);if(hours>=0&&hours<24)return hours<1?'hace menos de 1 hora':`hace ${hours} ${hours===1?'hora':'horas'}`;return 'compra confirmada'}
async function purchaseToasts(){try{const r=await fetch('/api/recent-activity?event=curso',{cache:'no-store'});if(!r.ok)return;const data=await r.json(),items=(data.purchases||[]).filter(p=>p.firstName&&['reto','taller'].includes(p.product));if(!items.length)return;const toast=$('reto-purchase-toast');let index=0,closed=false;const show=()=>{if(closed||index>=Math.min(items.length,4))return;const p=items[index++];$('reto-toast-title').textContent=`${p.firstName} se inscribió ${p.product==='reto'?'al reto':'a un taller de IA'}${p.recordings?' + grabaciones':''}`;$('reto-toast-subtitle').textContent=[p.province,recentTime(p.created)].filter(Boolean).join(' · ');$('reto-avatar').textContent=p.firstName[0].toUpperCase();toast.hidden=false;setTimeout(()=>toast.hidden=true,5500);if(index<Math.min(items.length,4))setTimeout(show,28000)};$('reto-toast-close').addEventListener('click',()=>{closed=true;toast.hidden=true});setTimeout(show,7000)}catch{}}
updateTotal();start();enablePixel();purchaseToasts();
