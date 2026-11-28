const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
require('../dist/app.js');require('../dist/receipt.js');
const app=globalThis.TFLApp,receipt=globalThis.TFLReceipt;
let checks=0;function check(fn){fn();checks++;}
for(const file of ['index.html','ruby-pearl/index.html','dist/index.html','dist/ruby-pearl/index.html']){
 const h=fs.readFileSync(path.join(root,file),'utf8');
 check(()=>assert.equal([...h.matchAll(/<form id="order-form"/g)].length,1));
 check(()=>assert.deepEqual([...h.matchAll(/data-product-tab="([^"]+)"/g)].map(m=>m[1]),['duo','pearl','ruby']));
 check(()=>assert.deepEqual([...h.matchAll(/data-product-panel="([^"]+)"/g)].map(m=>m[1]),['duo','pearl','ruby']));
 check(()=>assert.deepEqual([...h.matchAll(/name="offer" value="([^"]+)"/g)].map(m=>m[1]),['white','red','duo']));
 check(()=>assert.match(h,/data-receipt-url="\/ruby-pearl\/cam-on\.html"/));
 check(()=>assert.match(h,/rr-block rr-mask/));
 const ids=[...h.matchAll(/(?:^|\s)id="([^"]+)"/g)].map(m=>m[1]);
 check(()=>assert.equal(ids.length,new Set(ids).size));
 for(const m of h.matchAll(/(?:src|href)="((?:\.\.\/|dist\/|assets\/)[^"#]+)"/g))check(()=>assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),m[1].split('?')[0])),m[1]));
}
for(const name of ['pearl','ruby']){
 const h=fs.readFileSync(path.join(root,name,'index.html'),'utf8');
 check(()=>assert.match(h,/location\.replace\(destination\.href\)/));
 check(()=>assert.ok(h.includes("destination.hash='"+name+"'")));
 check(()=>assert.equal([...h.matchAll(/<form/g)].length,0));
}
for(const [id,sku] of [['white','TFL-540-BLANC-50'],['red','TFL-540-ROUGE-50'],['duo','TFL-540-BLANC-50']]){
 const c={customerName:'TEST Nguyễn A',phone:'0912345678',address:'Địa chỉ thử nghiệm, Hà Nội',note:'TEST'};
 const p=app.buildPayload(id,c,'304e130a-5a09-4f93-8ce0-019ea054f9f0');
 check(()=>assert.equal(p.items[0].sku,sku));
 check(()=>assert.equal(p.total,id==='duo'?998000:579000));
 const ack={success:true,schemaVersion:2,receiverVersion:2,orderId:'TEST',offerId:id,quantity:p.quantity,subtotal:p.subtotal,shipping:p.shipping,total:p.total,currency:'VND'};
 check(()=>assert.ok(receipt.valid(receipt.create(p,ack))));
}
console.log('Tabbed storefront: '+checks+' checks passed. No network orders sent.');