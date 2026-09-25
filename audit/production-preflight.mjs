import fs from 'node:fs';
import os from 'node:os';
const cfg=JSON.parse(fs.readFileSync(os.homedir()+'/.config/configstore/firebase-tools.json','utf8'));
const {getAccessToken}=await import('file:///C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const {access_token}=await getAccessToken(cfg.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
const headers={Authorization:'Bearer '+access_token};
const saved={date:new Date().toISOString()};
for(const [label,url] of Object.entries({rules:'https://firebaserules.googleapis.com/v1/projects/abp-agencia-de-seguros/releases/cloud.firestore',hosting:'https://firebasehosting.googleapis.com/v1beta1/sites/abp-agencia-de-seguros/releases?pageSize=1'})){
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(label+' '+r.status);
 saved[label]=await r.json();
 console.log(label,JSON.stringify(saved[label]));
}
fs.writeFileSync(new URL('production-before.json',import.meta.url),JSON.stringify(saved,null,2));
