(() => {
  'use strict';
  const tabs = [...document.querySelectorAll('[role="tab"][data-product-tab]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"][data-product-panel]')];
  const form = document.getElementById('order-form');
  if (tabs.length !== 3 || panels.length !== 3 || !form) return;
  const offers = Object.freeze({duo:'duo',pearl:'white',ruby:'red'});
  const titles = Object.freeze({
    duo:'Ruby & Pearl — Hãy chọn cách bạn xuất hiện',
    pearl:'Baccarat 540 Pearl — Ngọc trai tinh tế',
    ruby:'Baccarat 540 Ruby — Hồng ngọc quyền lực'
  });
  const announcement = {
    duo:'Bộ đôi 998.000đ · Miễn phí vận chuyển',
    pearl:'Pearl · 549.000đ / chai 50ml',
    ruby:'Ruby · 549.000đ / chai 50ml'
  };
  const radios = [...form.querySelectorAll('input[name="offer"]')];
  const submit = document.getElementById('submit-order');
  let active = '';
  const valid = name => Object.hasOwn(offers,name);
  function fromUrl(){
    const url = new URL(window.location.href);
    const hash = url.hash.slice(1);
    if (valid(hash)) return hash;
    if (hash.startsWith('pearl-')) return 'pearl';
    if (hash.startsWith('ruby-')) return 'ruby';
    const param = url.searchParams.get('tab');
    return valid(param) ? param : 'duo';
  }
  function update(name, {navigate=false, focus=false, scroll=false, initial=false} = {}){
    if (!valid(name) || (!initial && (submit?.getAttribute('aria-busy') === 'true' || radios.some(r=>r.disabled)))) return false;
    const changed = active !== name;
    if(!changed && !initial){ if(scroll) window.scrollTo({top:0,behavior:'auto'}); return true; }
    active = name;
    for(const tab of tabs){
      const selected = tab.dataset.productTab === name;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if(focus && selected) tab.focus({preventScroll:true});
    }
    for(const panel of panels) panel.hidden = panel.dataset.productPanel !== name;
    document.body.dataset.product = offers[name];
    document.body.dataset.activeTab = name;
    document.title = titles[name] + ' | The Fragrance Lab';
    const label = document.getElementById('tab-announcement');
    if(label) label.textContent = announcement[name];
    const target = radios.find(r=>r.value === offers[name]);
    if(target){
      target.checked = true;
      if(!initial) target.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(navigate){
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      url.hash = name;
      if(url.href !== window.location.href) window.history.pushState(null,'',url);
    }
    if(!initial) document.dispatchEvent(new CustomEvent('tfl:tab_selected',{detail:{offerId:offers[name],tab:name}}));
    if(scroll) window.scrollTo({top:0,behavior:'auto'});
    return true;
  }
  update(fromUrl(),{initial:true});
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>update(tab.dataset.productTab,{navigate:true,focus:true,scroll:true}));
    tab.addEventListener('keydown',event=>{
      let target;
      if(event.key==='ArrowRight') target=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft') target=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home') target=0;
      else if(event.key==='End') target=tabs.length-1;
      else return;
      event.preventDefault();
      update(tabs[target].dataset.productTab,{navigate:true,focus:true,scroll:true});
    });
  });
  document.querySelectorAll('[data-tab-open]').forEach(link=>link.addEventListener('click',event=>{
    if(event.button!==0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    update(link.dataset.tabOpen,{navigate:true,focus:true,scroll:true});
  }));
  const restore = () => update(fromUrl(),{scroll:false});
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',restore);
})();
