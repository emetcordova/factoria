const read=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const consent=()=>read('emet_marketing')==='yes';
const config=fetch('/api/config',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('config');return r.json()}).catch(()=>({checkoutEnabled:false,pixelId:null}));
let pixelLoaded=false;
export const consentAllowed=consent;
export const configuration=config;
function applySiteConfig(c){
 const date=c.eventDate||'Jueves 1 de octubre de 2026', time=c.eventTime||'Horario por confirmar', price=Number(c.course?.amount||19), priceText=`US$${price}`;
 document.querySelectorAll('.brand').forEach(el=>{if(!el.querySelector('.brand-logo')){el.textContent='';const img=document.createElement('img');img.className='brand-logo';img.src='/assets/emet-logo.png';img.alt='Emet Córdova';el.append(img)}});
 document.querySelectorAll('[data-event-date]').forEach(el=>el.textContent=date);
 document.querySelectorAll('[data-event-time]').forEach(el=>el.textContent=time);
 document.querySelectorAll('[data-course-price]').forEach(el=>el.textContent=priceText);
 document.querySelectorAll('[data-course-price-number]').forEach(el=>el.textContent=price);
 document.querySelectorAll('[data-whatsapp-group]').forEach(el=>el.href=c.whatsappUrl||'https://chat.whatsapp.com/B8WmTjXB53w6yMZji9maiE');
 document.querySelectorAll('.whatsapp-icon').forEach(el=>el.innerHTML='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true"><path fill="currentColor" d="M12 3.5a8.5 8.5 0 0 0-7.31 12.84L3.5 20.5l4.3-1.13A8.5 8.5 0 1 0 12 3.5Zm0 15.4a6.9 6.9 0 0 1-3.51-.96l-.25-.15-2.55.67.68-2.48-.16-.26A6.9 6.9 0 1 1 12 18.9Zm3.79-5.18c-.2-.1-1.18-.58-1.36-.65-.18-.06-.31-.1-.44.1-.13.2-.5.65-.61.78-.11.13-.23.15-.43.05-.2-.1-.85-.31-1.62-.99-.6-.53-1-1.18-1.11-1.38-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.34.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.07-.6-1.46-.16-.38-.32-.33-.44-.34h-.38c-.13 0-.34.05-.52.25-.18.2-.68.67-.68 1.64s.7 1.9.8 2.03c.1.13 1.38 2.1 3.34 2.95.47.2.84.32 1.13.41.48.15.92.13 1.27.08.39-.06 1.18-.48 1.35-.94.17-.46.17-.85.12-.94-.05-.08-.18-.13-.38-.23Z"/></svg>');
 const announcement=document.querySelector('.announcement strong');if(announcement)announcement.textContent=date.toUpperCase();
 const dateValue=new Date((c.eventDateISO||'2026-10-01')+'T12:00:00Z');
 const dateFormat=options=>new Intl.DateTimeFormat('es-PE',{...options,timeZone:'UTC'}).format(dateValue);
 const firstBenefit=document.querySelector('.benefit-bar span:first-child strong');if(firstBenefit)firstBenefit.textContent=dateFormat({day:'2-digit',month:'short'}).toUpperCase();
 const badge=document.querySelector('.offer-meta>span');if(badge){badge.replaceChildren(document.createTextNode(dateFormat({day:'2-digit'})),document.createElement('br'));const m=document.createElement('small');m.textContent=dateFormat({month:'long'}).toUpperCase();badge.append(m)}
 const cover=document.querySelector('.cover-bottom>span');if(cover)cover.textContent=dateFormat({day:'2-digit',month:'2-digit',year:'2-digit'});
 document.querySelectorAll('[data-schedule]').forEach(el=>el.textContent=date+' · '+time);
 import('./showcase.js?v=showcase-5').then(m=>m.renderSchedule(c));
 document.querySelectorAll(".hero-action .button[href='/checkout'],.price-card .button").forEach(el=>{const arrow=document.createElement('span');arrow.textContent='↗';el.textContent=`Quiero mi cupo por ${priceText} `;el.append(arrow)});
 const priceEl=document.querySelector('.price-card .price');if(priceEl)priceEl.innerHTML=`<span>US$</span>${price}`;
 const mobilePrice=document.querySelector('.mobile-cta strong');if(mobilePrice)mobilePrice.textContent=priceText;
 const mobileDate=document.querySelector('.mobile-cta span');if(mobileDate)mobileDate.textContent=`${date.replace(/^\w+\s+/,'')} · En vivo`;
 const offerDate=document.querySelector('.offer-meta strong');if(offerDate)offerDate.textContent=date;
 const offerTime=document.querySelector('.offer-meta p');if(offerTime)offerTime.textContent='En vivo por Zoom · '+time;
}
export async function enablePixel(){
 const c=await config;if(!consent()||!c.pixelId||pixelLoaded)return;
 pixelLoaded=true;
 const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
 fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];window.fbq=fbq;window._fbq=fbq;
 const s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(s);
 fbq('init',c.pixelId);fbq('consent','grant');fbq('track','PageView');
 if(location.pathname==='/')fbq('track','ViewContent',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'USD',value:c.course.amount});
 const q=new URLSearchParams(location.search),attribution={};
 for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(q.get(k))attribution[k]=q.get(k).slice(0,200);
 if(q.get('fbclid'))attribution.fbc='fb.1.'+Date.now()+'.'+q.get('fbclid').slice(0,200);
 try{if(Object.keys(attribution).length)sessionStorage.setItem('emet_attribution',JSON.stringify(attribution))}catch{}
}
export async function track(name,data={},eventID){await enablePixel();if(consent()&&window.fbq)window.fbq('track',name,data,eventID?{eventID}:{});}
export function attribution(){
 if(!consent())return {};
 let saved={};try{saved=JSON.parse(sessionStorage.getItem('emet_attribution')||'{}')}catch{}
 for(const name of ['fbp','fbc']){const v=document.cookie.split('; ').find(c=>c.startsWith('_'+name+'='));if(v)saved[name]=decodeURIComponent(v.split('=').slice(1).join('='));}
 return saved;
}
function clearAttribution(){try{sessionStorage.removeItem('emet_attribution')}catch{}for(const name of ['_fbp','_fbc']){document.cookie=name+'=; Max-Age=0; Path=/';document.cookie=name+'=; Max-Age=0; Path=/; Domain=.'+location.hostname;}}
function setConsent(value){write('emet_marketing',value);const banner=document.querySelector('#cookie-banner');if(banner)banner.hidden=true;if(value==='yes')enablePixel();else{if(window.fbq)window.fbq('consent','revoke');clearAttribution();}window.dispatchEvent(new Event('emet-consent'));}
document.querySelectorAll('[data-consent]').forEach(b=>b.addEventListener('click',()=>setConsent(b.dataset.consent)));
document.querySelectorAll('[data-cookie-settings]').forEach(b=>b.addEventListener('click',()=>{const el=document.querySelector('#cookie-banner');if(el)el.hidden=false}));
document.querySelectorAll('[data-privacy]').forEach(b=>b.addEventListener('click',()=>document.querySelector('#privacy-dialog')?.showModal()));
document.querySelector('.dialog-close')?.addEventListener('click',()=>document.querySelector('#privacy-dialog').close());
const privacy=document.querySelector('#privacy-dialog');privacy?.addEventListener('click',e=>{if(e.target===privacy){const r=privacy.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)privacy.close()}});
config.then(c=>{applySiteConfig(c);const banner=document.querySelector('#cookie-banner');if(banner&&c.pixelId&&!read('emet_marketing'))banner.hidden=false;enablePixel()});
// Social proof is displayed only after authentic records have been approved.
if(document.querySelector('#testimonios'))fetch('/proof.json').then(r=>r.json()).then(data=>{
 const safeImage=url=>typeof url==='string'&&(url.startsWith('/assets/')||url.startsWith('https://'));
 const brands=(data.brands||[]).filter(b=>b.approved&&b.name&&b.source);
 for(const b of brands){const el=document.createElement(b.logo&&safeImage(b.logo)?'img':'span');if(el.tagName==='IMG'){el.src=b.logo;el.alt=b.name;el.loading='lazy'}else el.textContent=b.name;document.querySelector('#brand-list').append(el)}
 if(brands.length)document.querySelector('#brands').hidden=false;
 const entries=(data.testimonials||[]).filter(t=>t.approved&&t.name&&t.quote&&t.source);
 for(const t of entries){const card=document.createElement('article');card.className='testimonial';const quote=document.createElement('blockquote');quote.textContent='“'+t.quote+'”';const footer=document.createElement('footer');if(t.photo&&safeImage(t.photo)){const img=document.createElement('img');img.src=t.photo;img.alt=t.name;img.loading='lazy';footer.append(img)}const name=document.createElement('div');name.textContent=t.name;if(t.role){const role=document.createElement('small');role.textContent=t.role;name.append(role)}footer.append(name);card.append(quote,footer);document.querySelector('#testimonials-list').append(card)}
 if(entries.length)document.querySelector('#testimonios').hidden=false;
}).catch(()=>{});
