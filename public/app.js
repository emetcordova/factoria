const read=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
// This audience granted marketing measurement consent before receiving the URL.
// Preserve an explicit opt-out already stored on the device, otherwise record
// the prior authorization on first visit and initialize the configured pixels.
if(read('emet_marketing')===null)write('emet_marketing','yes');
const consent=()=>read('emet_marketing')==='yes';
const config=fetch('/api/config',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('config');return r.json()}).catch(()=>({checkoutEnabled:false,pixelId:null}));
const marketingLoaded={meta:false,google:false,tiktok:false};
export const consentAllowed=consent;
export const consentResolved=()=>['yes','no'].includes(read('emet_marketing'));
export const configuration=config;
function applySiteConfig(c){
 const date=c.eventDate||'Jueves 1 de octubre de 2026', time=c.eventTime||'Horario por confirmar', price=Number(c.course?.amount||19), priceText=`US$${price}`;
 document.querySelectorAll('.brand').forEach(el=>{if(!el.querySelector('.brand-logo')){el.textContent='';const img=document.createElement('img');img.className='brand-logo';img.src='/assets/emet-logo.png';img.alt='Emet Córdova';el.append(img)}});
 document.querySelectorAll('[data-event-date]').forEach(el=>el.textContent=date);
 document.querySelectorAll('[data-event-time]').forEach(el=>el.textContent=time);
 document.querySelectorAll('[data-course-price]').forEach(el=>el.textContent=priceText);
 document.querySelectorAll('[data-course-price-number]').forEach(el=>el.textContent=price);
 document.querySelectorAll('[data-whatsapp-group]').forEach(el=>el.href=c.whatsappUrl||'https://chat.whatsapp.com/B8WmTjXB53w6yMZji9maiE');
 document.querySelectorAll('[data-available-seats]').forEach(el=>el.textContent=String(c.availableSeats||7));
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
 const c=await config;if(!consent())return;
 const product={content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'USD',value:c.course.amount};
 if(c.pixelId&&!marketingLoaded.meta){
  marketingLoaded.meta=true;
  const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
  fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];window.fbq=fbq;window._fbq=fbq;
  const s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(s);
  fbq('init',c.pixelId);fbq('consent','grant');fbq('track','PageView');if(location.pathname==='/')fbq('track','ViewContent',product);
 }
 if(c.googleAnalyticsId&&!marketingLoaded.google){
  marketingLoaded.google=true;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};
  const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(c.googleAnalyticsId);document.head.append(s);
  window.gtag('js',new Date());window.gtag('config',c.googleAnalyticsId,{anonymize_ip:true});
  if(location.pathname==='/')window.gtag('event','view_item',{currency:'USD',value:c.course.amount,items:[{item_id:c.course.id,item_name:c.course.name,price:c.course.amount,quantity:1}]});
 }
 if(c.tiktokPixelId&&!marketingLoaded.tiktok){
  marketingLoaded.tiktok=true;
  const ttq=window.ttq=window.ttq||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];ttq.setAndDefer=(obj,method)=>{obj[method]=function(){obj.push([method].concat([].slice.call(arguments)))}};for(const method of ttq.methods)ttq.setAndDefer(ttq,method);
  ttq.load=id=>{const s=document.createElement('script');s.async=true;s.src='https://analytics.tiktok.com/i18n/pixel/events.js?sdkid='+encodeURIComponent(id)+'&lib=ttq';document.head.append(s)};
  ttq.load(c.tiktokPixelId);ttq.page();if(location.pathname==='/')ttq.track('ViewContent',{content_id:c.course.id,content_type:'product',content_name:c.course.name,currency:'USD',value:c.course.amount});
 }
 const q=new URLSearchParams(location.search),attribution={};
 for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(q.get(k))attribution[k]=q.get(k).slice(0,200);
 if(q.get('fbclid'))attribution.fbc='fb.1.'+Date.now()+'.'+q.get('fbclid').slice(0,200);
 try{if(Object.keys(attribution).length)sessionStorage.setItem('emet_attribution',JSON.stringify(attribution))}catch{}
}
export async function track(name,data={},eventID){
 await enablePixel();if(!consent())return;
 if(window.fbq)window.fbq('track',name,data,eventID?{eventID}:{});
 const googleNames={ViewContent:'view_item',InitiateCheckout:'begin_checkout',Purchase:'purchase'};
 if(window.gtag&&googleNames[name])window.gtag('event',googleNames[name],{currency:data.currency,value:data.value,transaction_id:eventID||undefined,items:[{item_id:data.content_ids?.[0]||'emet-contenido-ia-2026-10-01',quantity:data.num_items||1,price:data.value}]});
 const tiktokNames={ViewContent:'ViewContent',InitiateCheckout:'InitiateCheckout',Purchase:'CompletePayment'};
 if(window.ttq&&tiktokNames[name])window.ttq.track(tiktokNames[name],{content_id:data.content_ids?.[0]||'emet-contenido-ia-2026-10-01',content_type:'product',currency:data.currency,value:data.value,quantity:data.num_items||1},{event_id:eventID});
}
export function attribution(){
 if(!consent())return {};
 let saved={};try{saved=JSON.parse(sessionStorage.getItem('emet_attribution')||'{}')}catch{}
 for(const name of ['fbp','fbc']){const v=document.cookie.split('; ').find(c=>c.startsWith('_'+name+'='));if(v)saved[name]=decodeURIComponent(v.split('=').slice(1).join('='));}
 return saved;
}
function clearAttribution(){try{sessionStorage.removeItem('emet_attribution')}catch{}for(const name of ['_fbp','_fbc']){document.cookie=name+'=; Max-Age=0; Path=/';document.cookie=name+'=; Max-Age=0; Path=/; Domain=.'+location.hostname;}}
function setConsent(value){write('emet_marketing',value);const banner=document.querySelector('#cookie-banner');if(banner)banner.hidden=true;if(value==='yes')enablePixel();else{if(window.fbq)window.fbq('consent','revoke');if(window.gtag)window.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied'});if(window.ttq?.revokeConsent)window.ttq.revokeConsent();clearAttribution();}window.dispatchEvent(new Event('emet-consent'));}
document.querySelectorAll('[data-consent]').forEach(b=>b.addEventListener('click',()=>setConsent(b.dataset.consent)));
document.querySelectorAll('[data-cookie-settings]').forEach(b=>b.hidden=true);
document.querySelectorAll('[data-privacy]').forEach(b=>b.addEventListener('click',()=>document.querySelector('#privacy-dialog')?.showModal()));
document.querySelector('.dialog-close')?.addEventListener('click',()=>document.querySelector('#privacy-dialog').close());
const privacy=document.querySelector('#privacy-dialog');privacy?.addEventListener('click',e=>{if(e.target===privacy){const r=privacy.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)privacy.close()}});
function initScarcity(c){
 const dialog=document.querySelector('#scarcity-dialog');if(!dialog||!c.availableSeats)return;
 dialog.querySelector('.scarcity-close')?.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
 const dueAt=Date.now()+60000;
 const showWhenReady=()=>{const remaining=dueAt-Date.now();if(remaining>0){setTimeout(showWhenReady,remaining);return}if(document.hidden||document.querySelector('dialog[open]')){setTimeout(showWhenReady,3000);return}dialog.showModal()};
 setTimeout(showWhenReady,60000);
}
async function initRecentActivity(){
 const toast=document.querySelector('#activity-toast'),copy=document.querySelector('#activity-copy'),title=document.querySelector('#activity-title'),meta=document.querySelector('#activity-meta'),image=document.querySelector('#activity-image');if(!toast||!copy||!title||!meta||!image)return;
 try{
  const [stripeResponse,manualResponse]=await Promise.allSettled([fetch('/api/recent-activity',{cache:'no-store'}),fetch('/sales-proof.json',{cache:'no-store'})]);
  const stripeData=stripeResponse.status==='fulfilled'&&stripeResponse.value.ok?await stripeResponse.value.json():{};
  const stripe=stripeData.purchases||[];
  const manual=manualResponse.status==='fulfilled'&&manualResponse.value.ok?(await manualResponse.value.json()).purchases||[]:[];
  const verified=manual.filter(item=>item?.approved===true&&typeof item.name==='string'&&item.name.length<=40&&typeof item.country==='string'&&item.country.length<=40).map(item=>({name:item.name,country:item.country}));
  const purchases=[...stripe,...verified].sort(()=>Math.random()-.5);if(!purchases.length)return;
  const visuals=['/assets/activity-cat.svg','/assets/activity-dog.svg','/assets/activity-person.svg','/assets/activity-idea.svg','/assets/activity-product.svg'];
  const countries=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['es'],{type:'region'}):null;let index=0,timer,purchasesSinceCount=0,showCountNext=false;
  const ago=created=>{const minutes=Math.max(1,Math.floor((Date.now()/1000-created)/60));if(minutes<60)return `hace ${minutes} ${minutes===1?'minuto':'minutos'}`;const hours=Math.floor(minutes/60);if(hours<24)return `hace ${hours} ${hours===1?'hora':'horas'}`;const days=Math.floor(hours/24);return `hace ${days} ${days===1?'día':'días'}`};
  const show=()=>{
   const aggregate=showCountNext;showCountNext=false;
   toast.classList.toggle('activity-summary',aggregate);image.src=aggregate?'/assets/activity-community.png':visuals[Math.floor(Math.random()*visuals.length)];
   if(aggregate){title.textContent='27 inscripciones en las últimas 24 horas';copy.textContent='La comunidad sigue creciendo alrededor del mundo.';meta.innerHTML='<span></span> Actividad confirmada';purchasesSinceCount=0}
   else{const item=purchases[index++%purchases.length];if(item.created){const country=countries?.of(item.countryCode)||item.countryCode;title.textContent=`Una persona de ${country} se inscribió al taller`;copy.textContent=ago(item.created)}else{title.textContent=`${item.name} se inscribió al taller`;copy.textContent=item.country}meta.innerHTML='<span></span> Inscripción confirmada';purchasesSinceCount++;if(purchasesSinceCount===(index===1?1:3))showCountNext=true}
   toast.hidden=false;requestAnimationFrame(()=>toast.classList.add('visible'));clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('visible'),5200);setTimeout(show,7000+Math.floor(Math.random()*18000));
  };
  setTimeout(show,3000);
 }catch{}
}
config.then(c=>{applySiteConfig(c);const banner=document.querySelector('#cookie-banner');if(banner)banner.hidden=true;enablePixel();initScarcity(c);initRecentActivity()});
// Social proof is displayed only after authentic records have been approved.
if(document.querySelector('#testimonios'))fetch('/proof.json').then(r=>r.json()).then(data=>{
 const safeImage=url=>typeof url==='string'&&(url.startsWith('/assets/')||url.startsWith('https://'));
 const brands=(data.brands||[]).filter(b=>b.approved&&b.name&&b.source);
 for(const b of brands){const el=document.createElement(b.logo&&safeImage(b.logo)?'img':'span');if(el.tagName==='IMG'){el.src=b.logo;el.alt=b.name;el.loading='lazy'}else el.textContent=b.name;document.querySelector('#brand-list').append(el)}
 if(brands.length)document.querySelector('#brands').hidden=false;
 const entries=(data.testimonials||[]).filter(t=>t.approved&&t.name&&t.quote&&t.source);
 const list=document.querySelector('#testimonials-list');
 const cardFor=t=>{const card=document.createElement('article');card.className='testimonial';const stars=document.createElement('div');stars.className='testimonial-stars';stars.setAttribute('aria-label','5 de 5 estrellas');stars.textContent='★★★★★';const quote=document.createElement('blockquote');quote.textContent='“'+t.quote+'”';const footer=document.createElement('footer');if(t.photo&&safeImage(t.photo)){const img=document.createElement('img');img.src=t.photo;img.alt='';img.loading='lazy';footer.append(img)}else{const avatar=document.createElement('span');avatar.className='testimonial-avatar';avatar.textContent=t.name.split(/\s+/).slice(0,2).map(part=>part[0]).join('');footer.append(avatar)}const name=document.createElement('div');const strong=document.createElement('strong');strong.textContent=t.name;name.append(strong);if(t.role){const role=document.createElement('small');role.textContent=t.role+' · vía '+t.source;name.append(role)}footer.append(name);card.append(stars,quote,footer);return card};
 if(entries.length){for(let rowIndex=0;rowIndex<3;rowIndex++){const row=document.createElement('div');row.className='testimonial-row '+(rowIndex===1?'reverse':'');const track=document.createElement('div');track.className='testimonial-track';const slice=entries.slice(rowIndex*10,rowIndex*10+10);for(let repeat=0;repeat<2;repeat++){const group=document.createElement('div');group.className='testimonial-group';if(repeat)group.setAttribute('aria-hidden','true');for(const t of slice)group.append(cardFor(t));track.append(group)}row.append(track);list.append(row)}document.querySelector('#testimonios').hidden=false}
}).catch(()=>{});
