import fs from 'node:fs';
import os from 'node:os';
const config=JSON.parse(fs.readFileSync(os.homedir()+'/.config/configstore/firebase-tools.json','utf8'));
const {getAccessToken}=await import('file:///C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const session=await getAccessToken(config.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
const token=session.access_token;
if(!token) throw Error('No Firebase session');
const project='abp-agencia-de-seguros';
const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
const release=await fetch(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`,{headers});
const r=await release.json();
console.log('Deployed rules release:',release.status);
if(r.rulesetName){const response=await fetch(`https://firebaserules.googleapis.com/v1/${r.rulesetName}`,{headers});const body=await response.json();fs.mkdirSync('audit',{recursive:true});for(const f of body.source?.files||[])fs.writeFileSync('audit/deployed-firestore.rules',f.content);console.log('Rules saved:',response.status);}
const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
for(const collection of ['clients','activities','clientPolicies','clientChangeNotifications','vouchers','chartOfAccounts','companies/abp/commissions']){
 const response=await fetch(`${base}/${collection}?pageSize=1&mask.fieldPaths=__name__`,{headers});const body=await response.json();console.log('Read',collection,response.status,'sampleCount',body.documents?.length||0);
}
const anonymous=await fetch(`${base}/clients?pageSize=1&mask.fieldPaths=__name__`);console.log('Unauthenticated read:',anonymous.status);

const auditId='audit-'+crypto.randomUUID();
const targets=['clients','activities','chartOfAccounts','vouchers','companies/abp/commissions','clientPolicies','clientPolicies/'+auditId+'/insuredPeople'];
const tracked=[];
const results=[];
try {
 for (const collection of targets) {
  const path=collection+'/'+auditId;
  const url=base+'/'+path;
  const initial=await fetch(url,{headers});
  if(initial.status!==404)throw Error('Target is not confirmed absent');
  tracked.push(url);
  const create=await fetch(url+'?currentDocument.exists=false',{method:'PATCH',headers,body:JSON.stringify({fields:{auditMarker:{stringValue:auditId},companyId:{stringValue:auditId},clientUid:{stringValue:auditId},name:{stringValue:'PRUEBA TEMPORAL'},auditStep:{integerValue:'1'}}})});
  if(create.status!==200)throw Error('Create failed '+collection+' '+create.status);
  const read=await fetch(url,{headers});const original=await read.json();
  const update=await fetch(url+'?updateMask.fieldPaths=auditStep&currentDocument.updateTime='+encodeURIComponent(original.updateTime),{method:'PATCH',headers,body:JSON.stringify({fields:{auditStep:{integerValue:'2'}}})});
  const verify=await fetch(url,{headers});const changed=await verify.json();
  const ok=update.status===200&&changed.fields?.auditStep?.integerValue==='2';
  results.push({collection,create:create.status,read:read.status,update:update.status,verified:ok});
  console.log('CRUD',collection,ok?'PASS':'FAIL');
 }
} finally {
 let remaining=0;
 for(const url of tracked.reverse()){
  const deletion=await fetch(url,{method:'DELETE',headers});
  const check=await fetch(url,{headers});
  if(check.status!==404){remaining++;console.log('Cleanup failure',url,deletion.status,check.status);}
 }
 console.log('Cleanup verified:',tracked.length,'temporary documents; remaining:',remaining);
 fs.writeFileSync('audit/database-crud-results.json',JSON.stringify({date:new Date().toISOString(),auditId,authorization:'Existing administrative IAM session; does not validate client Security Rules',results,cleanup:{checked:tracked.length,remaining}},null,2));
 if(remaining)process.exitCode=2;
}
