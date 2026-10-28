import './showcase.js?v=hero-controls-1';
import {configuration,consentAllowed,attribution,track} from './app.js?v=pasarela-1';
let opening=false;
const buttons=[...document.querySelectorAll('[data-checkout-cta]')];
const error=document.querySelector('#payment-error');
// Restore controls when returning from Stripe through the browser back cache.
window.addEventListener('pageshow',()=>{opening=false;buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy')})});
buttons.forEach(button=>button.addEventListener('click',async()=>{
 if(opening)return;
 opening=true;error.hidden=true;
 buttons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true')});
 try{
  const c=await configuration;
  if(!c.checkoutEnabled)throw Error('No podemos abrir el pago en este momento. Inténtalo nuevamente en unos minutos.');
  const requestId=crypto.randomUUID();
  const response=await fetch('/api/checkout-pasarela',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,consent:consentAllowed(),...attribution()})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'No pudimos iniciar el pago.');
  const url=new URL(data.url);
  if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw Error('No pudimos validar el enlace de pago. Inténtalo nuevamente.');
  await track('InitiateCheckout',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'PEN',value:50,num_items:1},'checkout_'+data.sessionId);
  window.location.assign(url.href);
 }catch(e){
  error.textContent=e.message||'No pudimos abrir Stripe. Inténtalo nuevamente.';error.hidden=false;
  opening=false;buttons.forEach(b=>{b.disabled=false;b.removeAttribute('aria-busy')});
 }
}));
