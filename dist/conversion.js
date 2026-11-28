(() => {
  'use strict';
  const DURATION_MS=869000;
  const POPUP_DELAY_MS=60000;
  const TIMER_KEY='tfl:offer-reminder-end:v1';
  const POPUP_KEY='tfl:quick-order-seen:v1';
  const get=(key)=>{try{return window.sessionStorage.getItem(key)}catch(_){return null}};
  const put=(key,val)=>{try{window.sessionStorage.setItem(key,String(val))}catch(_){}};
  const clock=document.getElementById('offer-clock');
  const clockLabel=document.getElementById('offer-clock-label');
  const bar=document.getElementById('offer-clock-bar');
  if(clock&&clockLabel&&bar){
    let deadline=Number(get(TIMER_KEY));
    const now=Date.now();
    if(!Number.isFinite(deadline)||deadline<=0||deadline>now+DURATION_MS){
      deadline=now+DURATION_MS;
      put(TIMER_KEY,deadline);
    }
    let isCampaignDeadline=false;
    let tickId;
    function tick(){
      const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
      clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      bar.dataset.expired=String(seconds===0);
      clockLabel.textContent=seconds===0?(isCampaignDeadline?'Ưu đãi đã kết thúc':'Ưu đãi Tết'):(isCampaignDeadline?'Ưu đãi kết thúc sau:':'Ưu đãi Tết · Thời gian chọn:');
      clock.setAttribute('aria-label',isCampaignDeadline?'Thời gian còn lại của ưu đãi':'Thời gian chọn ưu đãi trong phiên');
      if(seconds===0&&tickId){clearInterval(tickId);tickId=null;}
      return seconds;
    }
    function runClock(){
      if(tickId){clearInterval(tickId);tickId=null;}
      if(tick()>0)tickId=setInterval(tick,250);
    }
    // The exact campaign-end copy is reserved for an authoritative, enforced deadline.
    // No client-side session reminder is represented as a price expiration.
    function usePromotion(promotion){
      if(!promotion||promotion.enforced!==true||typeof promotion.endsAt!=='string')return;
      const end=Date.parse(promotion.endsAt);
      if(!Number.isFinite(end))return;
      isCampaignDeadline=true;
      deadline=end;
      runClock();
    }
    document.addEventListener('tfl:receiver_ready',event=>usePromotion(event.detail?.promotion));
    usePromotion(window.TFL_RECEIVER_PROMOTION);
    bar.hidden=false;
    runClock();
    document.addEventListener('visibilitychange',tick);
  }
  const form=document.getElementById('order-form');
  const popup=document.getElementById('quick-order-dialog');
  const slot=document.getElementById('quick-order-slot');
  const checkout=document.getElementById('dat-hang');
  const submit=document.getElementById('submit-order');
  if(!form||!popup||!slot||!checkout||!submit||typeof popup.showModal!=='function')return;
  const originalParent=form.parentNode;
  const anchor=document.createComment('shared-order-form-home');
  originalParent.insertBefore(anchor,form);
  const fields=['customerName','phone','address','note'];
  let previouslyFocused=null, interacted=false, used=false, timer=null, restoreFocus=true;
  function busy(){return submit.getAttribute('aria-busy')==='true'}
  function selected(){
    return form.querySelector('input[name="offer"]:checked')?.value||'duo';
  }
  function syncPreview(){
    const offer=window.TFLApp?.offers[selected()];
    if(!offer)return;
    const name=document.getElementById('quick-order-name'),price=document.getElementById('quick-order-price'),img=document.getElementById('quick-order-image');
    if(name)name.textContent=offer.name;
    if(price)price.textContent=window.TFLApp.money(offer.total)+' · '+offer.spec;
    if(img){const url=(window.TFL_ASSET_BASE||'')+offer.image;if(img.getAttribute('src')!==url)img.src=url;img.alt=offer.name}
  }
  function restoreForm(){
    if(form.parentNode!==originalParent)anchor.after(form);
  }
  function closePopup(){
    if(popup.open)popup.close();
    restoreForm();
  }
  function isCheckoutVisible(){
    const r=checkout.getBoundingClientRect();
    return Math.min(r.bottom,window.innerHeight)-Math.max(r.top,0)>Math.min(160,window.innerHeight*.3);
  }
  function showPopup(){
    if(used||get(POPUP_KEY)||document.hidden||interacted||busy()||submit.disabled||form.contains(document.activeElement)||isCheckoutVisible()||document.querySelector('dialog[open]'))return false;
    used=true;put(POPUP_KEY,1);
    previouslyFocused=document.activeElement;
    restoreFocus=true;
    syncPreview();
    slot.append(form);
    try{popup.showModal();return true}catch(_){restoreForm();return false}
  }
  form.addEventListener('focusin',()=>{if(!popup.open)interacted=true});
  form.addEventListener('input',()=>{if(!popup.open)interacted=true});
  document.addEventListener('tfl:offer_selected',syncPreview);
  form.addEventListener('change',syncPreview);
  popup.querySelector('[data-quick-close]').addEventListener('click',closePopup);
  popup.addEventListener('click',e=>{if(e.target===popup){const r=popup.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePopup()}});
  popup.addEventListener('close',()=>{
    restoreForm();
    if(restoreFocus&&previouslyFocused&&previouslyFocused.isConnected)previouslyFocused.focus({preventScroll:true});
  });
  form.addEventListener('submit',()=>{
    if(!popup.open||busy())return;
    const customer=Object.fromEntries(fields.map(name=>[name,form.elements.namedItem(name)?.value||'']));
    if(!window.TFLApp?.validateCustomer(customer).valid||form.elements.namedItem('website')?.value)return;
    restoreFocus=false;
    closePopup();
    checkout.scrollIntoView({block:'start',behavior:'auto'});
  },true);
  // Count only time spent with the document visible; no repeated popups or reset on tab change.
  let elapsed=0,last=Date.now();
  function poll(){
    const now=Date.now();
    if(!document.hidden)elapsed+=Math.max(0,now-last);
    last=now;
    if(used||get(POPUP_KEY)||interacted){clearInterval(timer);return}
    if(elapsed>=POPUP_DELAY_MS&&!document.hidden){
      // Skip people already at checkout. Do not surprise them later while entering details.
      if(isCheckoutVisible()||form.contains(document.activeElement)){
        used=true;put(POPUP_KEY,1);clearInterval(timer);return;
      }
      if(showPopup())clearInterval(timer);
    }
  }
  document.addEventListener('visibilitychange',()=>{last=Date.now()});
  if(!get(POPUP_KEY))timer=setInterval(poll,1000);
})();
