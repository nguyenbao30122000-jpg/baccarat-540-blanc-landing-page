const expected={white:579000,red:579000,duo:998000};
(async()=>{
  // The screenshot uses visually identical uppercase I and lowercase l glyphs.
  // Check only those exact transcription alternatives of the supplied deployment ID.
  for(const first of ['I','l'])for(const second of ['I','l']){
    const id='AKfycbw2OfKYKScVpcxMVk8zvXTAXpp3'+first+'CPxWYwRxfNp3boVA'+second+'r4ajSp0svwaRbw_BT2vKty';
    try{
      const res=await fetch('https://script.google.com/macros/s/'+id+'/exec?action=health',{signal:AbortSignal.timeout(10000)});
      const data=await res.json();
      if(res.ok && data.service==='TFL order receiver' && data.receiverVersion===2 && data.schemaVersion===2 && Object.entries(expected).every(([k,v])=>data.offers?.[k]?.total===v)){
        console.log('VERIFIED_RECEIVER '+JSON.stringify({id,version:data.receiverVersion,offers:Object.fromEntries(Object.keys(expected).map(k=>[k,{total:data.offers[k].total,quantity:data.offers[k].quantity,items:data.offers[k].items}]))}));return;
      }
      console.log('HEALTH_NOT_MATCHED '+JSON.stringify({status:res.status,version:data.receiverVersion||data.version||null}));
    }catch(e){console.log('HEALTH_UNAVAILABLE '+String(e.message).slice(0,140));}
  }
  process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
