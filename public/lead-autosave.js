export function initLeadAutosave({form,nameInput,phoneInput,dialog}){
 const notice=form.querySelector('[data-autosave-notice]');
 let enabled=false,timer,retryTimer,whatsappClicked=false,lastSaved='',revision=0;
 let id;try{id=sessionStorage.getItem('emet_lead_id')}catch{}
 if(!/^[a-f0-9-]{36}$/i.test(id||''))id=crypto.randomUUID();
 try{sessionStorage.setItem('emet_lead_id',id)}catch{}
 const pending=new Set();
 function snapshot(){
  const name=nameInput.value.trim(),rawPhone=phoneInput.value.trim(),phone=rawPhone.replace(/\D/g,'');
  if(!name||name.length>80||!/^\+?[0-9()\s.-]+$/.test(rawPhone)||!/^\d{9,15}$/.test(phone))return null;
  return {name,phone,whatsappClicked};
 }
 async function flush(){
  clearTimeout(timer);clearTimeout(retryTimer);
  if(!enabled)return;
  const data=snapshot();if(!data)return;
  const key=JSON.stringify(data);if(key===lastSaved||pending.has(key))return;
  const currentRevision=revision=Math.max(Date.now(),revision+1);
  pending.add(key);
  try{
   const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,revision:currentRevision,...data}),keepalive:true});
   const result=await response.json();
   if(!response.ok||result.saved!==true)throw Error('save_failed');
   if(currentRevision===revision)lastSaved=key;
  }catch{retryTimer=setTimeout(flush,5000);}
  finally{pending.delete(key);}
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(flush,700);}
 [nameInput,phoneInput].forEach(input=>{input.addEventListener('input',schedule);input.addEventListener('change',flush);input.addEventListener('blur',flush);});
 dialog.addEventListener('close',flush);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
 window.addEventListener('pagehide',flush);
 window.addEventListener('online',flush);
 fetch('/api/leads',{cache:'no-store'}).then(response=>response.ok?response.json():{}).then(config=>{enabled=config.enabled===true;if(notice)notice.hidden=!enabled;if(enabled)schedule();}).catch(()=>{if(notice)notice.hidden=true});
 return {markWhatsApp(){whatsappClicked=true;flush();}};
}
