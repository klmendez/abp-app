import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
const cfg=JSON.parse(fs.readFileSync(os.homedir()+'/.config/configstore/firebase-tools.json','utf8'));
const {getAccessToken}=await import('file:///C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const {access_token}=await getAccessToken(cfg.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
const headers={Authorization:'Bearer '+access_token};
const release=await fetch('https://firebaserules.googleapis.com/v1/projects/abp-agencia-de-seguros/releases/cloud.firestore',{headers}).then(r=>r.json());
const ruleset=await fetch('https://firebaserules.googleapis.com/v1/'+release.rulesetName,{headers}).then(r=>r.json());
const rules=ruleset.source.files[0].content;
fs.writeFileSync(new URL('production-current.rules',import.meta.url),rules);
const normalize=s=>s.replace(/\r\n/g,'\n');
const sameRules=normalize(rules)===normalize(fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8'));
console.log('Published rules match tested rules:',sameRules);
const result={date:new Date().toISOString(),release,rulesMatch:sameRules,sites:[]};
for(const [url,folder] of [['https://abp-agencia-de-seguros.web.app/','D:/W/ABP-gestion/dist'],['https://abpsegurosltda.com/','D:/W/abp-insurance/.tmp-audit-build']]){
 const response=await fetch(url+'?verification='+Date.now(),{signal:AbortSignal.timeout(20000)});const html=await response.text();
 const local=fs.readFileSync(folder+'/index.html','utf8');
 const assets=[...local.matchAll(/(?:src|href)="([^\"]+\.(?:js|css))"/g)].map(m=>m[1]);
 const checks=[];
 for(const asset of assets){const r=await fetch(new URL(asset,url),{signal:AbortSignal.timeout(20000)});const content=Buffer.from(await r.arrayBuffer());const expected=fs.readFileSync(folder+'/'+asset.replace(/^\.?\//,''));checks.push({asset,status:r.status,matches:crypto.createHash('sha256').update(content).digest('hex')===crypto.createHash('sha256').update(expected).digest('hex')});}
 const check={url,status:response.status,indexMatches:normalize(html)===normalize(local),assets:checks};result.sites.push(check);console.log(JSON.stringify(check));
}
fs.writeFileSync(new URL('production-verification.json',import.meta.url),JSON.stringify(result,null,2));
if(!sameRules||result.sites.some(s=>!s.indexMatches||s.status!==200||s.assets.some(a=>!a.matches||a.status!==200)))process.exitCode=1;
