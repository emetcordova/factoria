const read=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
const write=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const consent=()=>read('emet_marketing')==='yes';
const config=fetch('/api/config',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('config');return r.json()}).catch(()=>({checkoutEnabled:false,pixelId:null}));
let pixelLoaded=false;
export const consentAllowed=consent;
export const configuration=config;
export async function enablePixel(){
 const c=await config;if(!consent()||!c.pixelId||pixelLoaded)return;
 pixelLoaded=true;
 const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments)};
 fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];window.fbq=fbq;window._fbq=fbq;
 const s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(s);
 fbq('init',c.pixelId);fbq('consent','grant');fbq('track','PageView');
 if(location.pathname==='/')fbq('track','ViewContent',{content_ids:[c.course.id],content_type:'product',content_name:c.course.name,currency:'USD',value:19});
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
config.then(c=>{const banner=document.querySelector('#cookie-banner');if(banner&&c.pixelId&&!read('emet_marketing'))banner.hidden=false;enablePixel()});
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
