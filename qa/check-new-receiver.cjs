const endpoint="https://script.google.com/macros/s/AKfycbxfuEhfwYTc9UcUoBTmtH_Ph9fv5oJ8i58YVs6MnPw5sy1eoVWYWSHw9lwhDqdPJWvt/exec";
(async()=>{
 const r=await fetch(endpoint+'?action=health',{signal:AbortSignal.timeout(15000),cache:'no-store'});
 const d=await r.json();
 const matched=r.ok&&d.service==='TFL order receiver'&&d.version===2&&d.receiverVersion===2&&d.schemaVersion===2&&[['white',579000,1],['red',579000,1],['duo',998000,2]].every(([k,v,n])=>d.offers?.[k]?.total===v&&d.offers[k].quantity===n);
 console.log('TFL_HEALTH '+JSON.stringify({status:r.status,version:d.version,receiverVersion:d.receiverVersion,schemaVersion:d.schemaVersion,matched,offers:d.offers}));
 if(!matched)process.exitCode=1;
})().catch(e=>{console.error('TFL_HEALTH_ERROR '+e.message);process.exitCode=1});
