const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const products = [
  {tab:'pearl', id:'white', name:'Pearl', qty:1, total:579000},
  {tab:'ruby', id:'red', name:'Ruby', qty:1, total:579000},
  {tab:'duo', id:'duo', name:'Combo', qty:2, total:998000}
];
const base = 'https://thefragrancelabperfume.shop/ruby-pearl/';
const run = (process.env.GITHUB_RUN_ID || 'manual')+'-v2';
const endpoint="https://script.google.com/macros/s/AKfycbxfuEhfwYTc9UcUoBTmtH_Ph9fv5oJ8i58YVs6MnPw5sy1eoVWYWSHw9lwhDqdPJWvt/exec";
const phone = '0900000000'; // Test placeholder. Never call or deliver.
async function check(browser, p, placement) {
  const label = 'TEST TFL ' + p.name + ' ' + placement.toUpperCase();
  const note = 'TEST ' + run + ' - ' + placement + ' - KHONG GOI, KHONG GIAO HANG';
  const result = {test:label, submitted:false, confirmed:false, postCount:0, total:p.total};
  const context = await browser.newContext({viewport:placement==='popup'?{width:390,height:844}:{width:1365,height:900}});
  try {
    // Do not pollute production ad conversions or replay with QA traffic.
    await context.route(/google-analytics\.com|googletagmanager\.com|connect\.facebook\.net|facebook\.com\/tr|tnano-session-replay\.baovan-tnano\.workers\.dev/, r=>r.abort());
    // Exercise the live storefront against the candidate deployment, without changing public traffic.
    await context.route(/\/config\.js(?:\?|$)/, async route=>{
      const response=await route.fetch();
      const body=(await response.text()).replace(/orderEndpoint:\s*['"][^'"]+['"]/, "orderEndpoint: '"+endpoint+"'");
      await route.fulfill({response,body});
    });
    const page = await context.newPage();
    page.on('request',r=>{if(r.method()==='POST'&&r.url().startsWith(endpoint)){result.postCount++;result.submitted=true;}});
    if(placement==='popup')await page.clock.install();
    const url = new URL(base);
    if(p.tab!=='duo')url.searchParams.set('tab',p.tab);
    url.searchParams.set('utm_source','tfl_qa_test');
    url.searchParams.set('utm_content',placement+'_'+p.tab+'_'+run);
    await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(()=>typeof window.TFLApp==='object'&&document.getElementById('submit-text')?.textContent==='ĐẶT HÀNG NGAY',{},{timeout:15000});
    assert.equal(await page.evaluate(()=>window.TFL_CONFIG.orderEndpoint),endpoint,'candidate endpoint must be used');
    const form = page.locator('#order-form');
    assert.equal(await form.locator('input[name="offer"]:checked').inputValue(),p.id,'wrong preselected offer');
    if(placement==='popup'){
      await page.clock.fastForward(61000);
      await page.locator('#quick-order-dialog[open] #order-form').waitFor({state:'visible',timeout:15000});
    } else {
      await form.scrollIntoViewIfNeeded();
      assert.equal(await form.locator('xpath=ancestor::dialog').count(),0,'not main form');
    }
    await form.locator('[name="customerName"]').fill(label);
    await form.locator('[name="phone"]').fill(phone);
    await form.locator('[name="address"]').fill('DIA CHI TEST - KHONG GIAO HANG - Thanh Hoa');
    const noteField=form.locator('[name="note"]');
    if(!await noteField.isVisible())await form.locator('details.compact-note summary').click();
    await noteField.fill(note);
    const submit=form.locator('#submit-order');
    assert.equal(await submit.isEnabled(),true,'submit is locked');
    await submit.click();
    await page.waitForFunction(()=>location.pathname.endsWith('/cam-on.html')||document.getElementById('form-status')?.dataset.state==='error',{},{timeout:70000});
    if(!page.url().includes('cam-on.html')){
      result.message=await page.locator('#form-status').innerText();
      throw Error('No confirmed thank-you page');
    }
    await page.locator('#confirmed-receipt').waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator('#receipt-customer-name').innerText(),label);
    assert.equal(await page.locator('#receipt-phone').innerText(),phone);
    assert.equal(await page.locator('#receipt-note').innerText(),note);
    assert.equal(await page.locator('#receipt-address').innerText(),'DIA CHI TEST - KHONG GIAO HANG - Thanh Hoa');
    assert.equal((await page.locator('#receipt-total').innerText()).replace(/[^0-9]/g,''),String(p.total));
    assert.match(await page.locator('#receipt-quantity').innerText(),new RegExp('^'+p.qty+' chai'));
    const rec=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tfl:last-confirmed-order')||'null'));
    assert.equal(rec.offerId,p.id);
    assert.equal(rec.receiverVersion,2,'v2 receiver required');
    assert.equal(result.postCount,1,'one submission to candidate endpoint');
    result.confirmed=true;
    result.orderId=rec.orderId;
    result.receiverVersion=rec.receiverVersion;
    result.message='Verified receipt after server acknowledgement';
  } catch(e) {
    result.error=String(e.message).slice(0,450);
  } finally { await context.close(); }
  console.log('TFL_RESULT '+JSON.stringify(result));
  return result;
}
(async()=>{
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const results=[];
    for(const p of products)for(const placement of ['main','popup'])results.push(await check(browser,p,placement));
    console.log('TFL_SUMMARY '+JSON.stringify(results));
    if(results.some(r=>!r.confirmed))process.exitCode=1;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
