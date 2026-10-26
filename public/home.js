// Initialize the gallery before configuration can import an older module URL.
import './showcase.js?v=hero-controls-1';
import './app.js?v=price-50-2';

const contactDialog=document.querySelector('#contact-dialog');
const contactForm=document.querySelector('#contact-form');
const nameInput=document.querySelector('#contact-name');
const phoneInput=document.querySelector('#contact-phone');
let contactTrigger,previousOverflow='';

document.querySelectorAll('[data-checkout-cta]').forEach(button=>{
 button.addEventListener('click',event=>{
  event.preventDefault();
  if(contactDialog.open)return;
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  contactTrigger=button;
  previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  contactDialog.showModal();
  nameInput.focus();
 });
});
contactDialog.querySelector('[data-contact-close]').addEventListener('click',()=>contactDialog.close());
contactDialog.addEventListener('click',event=>{
 const bounds=contactDialog.getBoundingClientRect();
 if(event.target===contactDialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))contactDialog.close();
});
contactDialog.addEventListener('close',()=>{
 document.body.style.overflow=previousOverflow;
 const target=contactTrigger?.getClientRects().length?contactTrigger:document.querySelector('.hero-action [data-checkout-cta]');
 target?.focus({preventScroll:true});
});
[nameInput,phoneInput].forEach(input=>input.addEventListener('input',()=>input.setCustomValidity('')));
contactForm.addEventListener('submit',event=>{
 event.preventDefault();
 const name=nameInput.value.trim();
 const phone=phoneInput.value.replace(/\D/g,'');
 nameInput.setCustomValidity(name?'':'Escribe tu nombre.');
 phoneInput.setCustomValidity(/^[0-9+()\s.-]+$/.test(phoneInput.value)&&/^\d{9,15}$/.test(phone)?'':'Escribe un celular válido, por ejemplo: 970 333 889.');
 if(!contactForm.reportValidity())return;
 const message=`Hola, soy ${name}. Mi número de celular es ${phoneInput.value.trim()}. Quiero información para reservar mi cupo en el taller de IA de S/ 50.`;
 const url=new URL(contactForm.action);
 url.searchParams.set('text',message);
 window.location.assign(url.href);
});
