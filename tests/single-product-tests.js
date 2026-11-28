const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');require('../dist/app.js');require('../dist/receipt.js');const app=globalThis.TFLApp,receipt=globalThis.TFLReceipt;
let checks=0;function check(fn){fn();checks++;}
for(const [slug,id,sku] of [['pearl','white','TFL-540-BLANC-50'],['ruby','red','TFL-540-ROUGE-50']]){
 for(const prefix of ['','dist/']){
  const page=fs.readFileSync(path.join(root,prefix,slug,'index.html'),'utf8'),form=page.match(/<form id="order-form"[\s\S]*?<\/form>/)[0];
  check(()=>assert.deepEqual([...form.matchAll(/name="offer" value="([^"]+)" checked/g)].map(m=>m[1]),[id]));
  check(()=>assert.equal([...form.matchAll(/name="offer"/g)].length,1));
  check(()=>assert.match(form,/data-receipt-url="\.\.\/ruby-pearl\/cam-on\.html"/));
  check(()=>assert.match(form,/rr-block rr-mask/));
  check(()=>assert.match(page,/id="order-total">579\.000đ/));
  check(()=>assert.match(page,/id="order-list-price">3\.995\.000đ/));
  for(const m of page.matchAll(/(?:href|src)="(\.\.\/[^"]+)"/g))check(()=>assert.ok(fs.existsSync(path.resolve(root,prefix,slug,m[1].split('?')[0])),m[1]));
  check(()=>assert.ok(fs.existsSync(path.resolve(root,prefix,slug,'../ruby-pearl/cam-on.html'))));
 }
 const customer={customerName:'TEST Nguyễn A',phone:'0912345678',address:'Địa chỉ thử nghiệm, Hà Nội',note:'TEST'},payload=app.buildPayload(id,customer,'304e130a-5a09-4f93-8ce0-019ea054f9f0');
 check(()=>assert.equal(payload.items[0].sku,sku));check(()=>assert.equal(payload.quantity,1));check(()=>assert.equal(payload.total,579000));
 const ack={success:true,schemaVersion:2,receiverVersion:2,orderId:'TEST',offerId:id,quantity:1,subtotal:549000,shipping:30000,total:579000,currency:'VND'};
 check(()=>assert.ok(receipt.valid(receipt.create(payload,ack))));
}
console.log('Independent product pages: '+checks+' checks passed. No network calls.');
