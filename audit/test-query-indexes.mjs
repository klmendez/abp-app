// Read-only queries with projections; no customer data is printed.
import fs from 'node:fs';
import os from 'node:os';
const config=JSON.parse(fs.readFileSync(os.homedir()+'/.config/configstore/firebase-tools.json','utf8'));
const {getAccessToken}=await import('file:///C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const {access_token}=await getAccessToken(config.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const base='https://firestore.googleapis.com/v1/projects/abp-agencia-de-seguros/databases/(default)/documents';
const headers={Authorization:'Bearer '+access_token,'Content-Type':'application/json'};
const results=[];
for(const field of ['mes','anio','intermediario','ramo','estado','estadoValidacion']){
 const query={from:[{collectionId:'commissions'}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:'AUDIT_NO_MATCH'}}},orderBy:[{field:{fieldPath:'fechaCarga'},direction:'DESCENDING'}],limit:1,select:{fields:[{fieldPath:'__name__'}]}};
 const response=await fetch(base+'/companies/abp:runQuery',{method:'POST',headers,body:JSON.stringify({structuredQuery:query}),signal:AbortSignal.timeout(20000)});
 const body=await response.json();const error=body.error||body.find?.(x=>x.error)?.error;
 results.push({filter:field,status:response.status,error:error?.status,message:error?.message?.split('https:')[0]});
 console.log(field,response.status,error?.status||'OK');
}
fs.writeFileSync(new URL('query-index-results.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),results},null,2));
