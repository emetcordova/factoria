import {configuration,consentAllowed,attribution,track} from './app.js?v=pasarela-3';
const loading=document.querySelector('#checkout-loading');
const error=document.querySelector('#checkout-error');
const form=document.querySelector('#checkout-form');
const payButton=document.querySelector('#pay-button');
const confirmErrors=document.querySelector('#confirm-errors');
let starting=false,tracked=false;
function loadStripe(){return new Promise((resolve,reject)=>{if(window.Stripe)return resolve();const s=document.createElement('script');s.src='https://js.stripe.com/dahlia/stripe.js';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar Stripe. Revisa tu conexión e inténtalo otra vez.'));document.head.append(s)})}
async function start(){
 if(starting)return;starting=true;loading.hidden=false;error.hidden=true;
 try{
  const [c]=await Promise.all([configuration,loadStripe()]);
  if(!c.checkoutEnabled)throw Error('El pago no está disponible en este momento. Inténtalo de nuevo.');
  document.querySelector('#test-mode').hidden=!c.testMode;
  const clientSecret=fetch('/api/checkout-pasarela',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),consent:consentAllowed(),...attribution()})}).then(async response=>{
   const data=await response.json();if(!response.ok||!data.clientSecret)throw Error(data.error||'No pudimos iniciar el pago.');
   if(!tracked){tracked=true;await track('InitiateCheckout',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'PEN',value:50,num_items:1},'checkout_'+data.sessionId)}
   return data.clientSecret;
  });
  const checkout=window.Stripe(c.publishableKey).initCheckoutElementsSdk({clientSecret});
  const result=await checkout.loadActions();
  if(result.type!=='success')throw Error(result.error?.message||'No se pudo iniciar el formulario.');
  const actions=result.actions;
  const session=actions.getSession();
  if(session.currency?.toLowerCase()!=='pen'||session.total?.total?.amount!==5000)throw Error('El importe no coincide con S/50. Recarga la página.');
  checkout.createContactDetailsElement().mount('#contact-details-element');
  checkout.createPaymentElement().mount('#payment-element');
  const update=state=>{payButton.disabled=!state.canConfirm};
  checkout.on('change',update);update(session);
  form.addEventListener('submit',async event=>{
   event.preventDefault();payButton.disabled=true;confirmErrors.hidden=true;
   try{const response=await actions.confirm();if(response.type==='error')throw Error(response.error.message||'No se pudo completar el pago.');}
   catch(e){confirmErrors.textContent=e.message||'Revisa tus datos e inténtalo de nuevo.';confirmErrors.hidden=false;payButton.disabled=false}
  },{once:false});
  form.hidden=false;loading.hidden=true;
 }catch(e){loading.hidden=true;error.hidden=false;document.querySelector('#checkout-message').textContent=e.message||'Inténtalo de nuevo.'}
 finally{starting=false}
}
document.querySelector('#retry-checkout').addEventListener('click',start);
start();
