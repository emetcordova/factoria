import {track,consentAllowed,configuration} from './app.js';
const $=id=>document.getElementById(id);const id=new URLSearchParams(location.search).get('session_id');
let confirmed=null;
async function purchase(){if(!confirmed?.allowTracking||!consentAllowed())return;let sent=false;try{sent=localStorage.getItem(confirmed.eventId)==='sent'}catch{}if(sent)return;await track('Purchase',{currency:confirmed.currency,value:confirmed.value,content_ids:['emet-contenido-ia-2026-10-01'],content_type:'product',num_items:1},confirmed.eventId);try{localStorage.setItem(confirmed.eventId,'sent')}catch{}}
window.addEventListener('emet-consent',purchase);
async function verify(){try{
 if(!id)throw Error('No encontramos una referencia de compra. Si ya pagaste, escríbenos para revisar tu inscripción.');
 const r=await fetch('/api/session?session_id='+encodeURIComponent(id),{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'No pudimos verificar tu pago.');
 $('reference').hidden=false;$('reference').textContent='Referencia: '+id;
 if(data.paid){confirmed=data;const cfg=await configuration;$('state-icon').textContent='✓';$('state-title').textContent='¡Tu pago está confirmado!';$('state-copy').textContent='Ya diste el primer paso. Entra ahora a la comunidad y guarda tu referencia de compra.';$('whatsapp-action').href=cfg.whatsappUrl||'https://chat.whatsapp.com/B8WmTjXB53w6yMZji9maiE';$('whatsapp-action').hidden=false;$('state-action').href='https://www.instagram.com/emetcordova/';$('state-action').textContent='Coordinar mi acceso ↗';$('state-action').hidden=false;await purchase();}
 else {$('state-icon').textContent='…';$('state-title').textContent=data.status==='open'?'Tu inscripción aún no está pagada.':'Tu pago aún no está confirmado.';$('state-copy').textContent='No hemos registrado un pago confirmado para esta referencia. Si completaste el proceso, espera unos minutos y consulta nuevamente.';$('payment-help').hidden=false;$('state-action').hidden=false;$('state-action').textContent='Consultar estado nuevamente';$('state-action').href=location.href;}
}catch(e){$('state-icon').textContent='?';$('state-title').textContent='Revisemos tu inscripción.';$('state-copy').textContent=e.message;$('payment-help').hidden=false;$('state-action').href='https://www.instagram.com/emetcordova/';$('state-action').textContent='Solicitar ayuda ↗';$('state-action').hidden=false;}}
verify();
