// Evaluates a downloaded rules snapshot using mocked users and documents.
// Does not create accounts, write documents, or deploy rules.
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('.', import.meta.url));
const config = JSON.parse(fs.readFileSync(os.homedir() + '/.config/configstore/firebase-tools.json', 'utf8'));
const { getAccessToken } = await import('file:///C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/auth.js');
const session = await getAccessToken(config.tokens.refresh_token, ['https://www.googleapis.com/auth/firebase']);
const prefix = '/databases/(default)/documents/';
const cases = [];
const person = {nombre:'Persona simulada',cedula:'SIMULADO',fechaNacimiento:'1990-01-01',fechaVinculacion:'2020-01-01',valorMensual:30000,observaciones:'',estado:'ACTIVO',fechaDesvinculacion:null,tipoNovedad:'INGRESO',valorNovedad:30000,diasNovedad:30};
function add(label, role, path, method, before, after, expectation='ALLOW') {
  const uid = 'simulated-' + role;
  const mockDocs = {
    ['users/'+uid]: {isPlatformSuperAdmin:role==='admin',status:'ACTIVE'},
    ['companies/abp/memberships/'+uid]: {role:role==='admin'?'ADMIN_EMPRESA':['staff','inactive-staff'].includes(role)?'ASESOR':'USUARIO',status:role==='inactive-staff'?'INACTIVE':'ACTIVE'},
    'clientPolicies/own': {clientUid:'simulated-client'},
    'clientPolicies/other': {clientUid:'simulated-other'},
  };
  const mocks = Object.entries(mockDocs).flatMap(([p,data])=>[
    {function:'exists',args:[{exactValue:prefix+p}],result:{value:true}},
    {function:'get',args:[{exactValue:prefix+p}],result:{value:{data}}},
  ]);
  mocks.push({function:'exists',args:[{anyValue:{}}],result:{value:false}});
  mocks.push({function:'get',args:[{anyValue:{}}],result:{undefined:{}}});
  cases.push({label,test:{expectation,request:{auth:role==='anonymous'?null:{uid,token:{}},path:prefix+path,method,...(after?{resource:{data:after}}:{})},...(before?{resource:{data:before}}:{}),functionMocks:mocks}});
}
add('Admin reads clients','admin','clients/example','get',{});
add('Admin creates root activity','admin','activities/example','create',null,{companyId:'abp'});
add('Admin reads root activity','admin','activities/example','get',{companyId:'abp'});
add('Admin writes voucher edit history','admin','vouchers/example/edits/example','create',null,{companyId:'abp'});
add('Admin writes voucher lines','admin','vouchers/example/lines/example','create',null,{companyId:'abp'});
add('Admin writes commissions','admin','companies/abp/commissions/example','create',null,{companyId:'abp'});
add('Staff reads clients','staff','clients/example','get',{companyId:'abp'});
add('Client reads own policy','client','clientPolicies/own','get',{clientUid:'simulated-client'});
add('Client denied other policy','client','clientPolicies/other','get',{clientUid:'simulated-other'},null,'DENY');
add('Client reads own insured','client','clientPolicies/own/insuredPeople/example','get',person);
add('Client denied other insured','client','clientPolicies/other/insuredPeople/example','get',person,null,'DENY');
add('Client creates insured','client','clientPolicies/own/insuredPeople/example','create',null,person);
add('Client edits name','client','clientPolicies/own/insuredPeople/example','update',person,{...person,nombre:'Persona editada'});
add('Client denied changing immutable start date','client','clientPolicies/own/insuredPeople/example','update',person,{...person,fechaVinculacion:'2020-02-01'},'DENY');
const retired={...person,estado:'DESVINCULADO',fechaDesvinculacion:'2026-08-19',tipoNovedad:'RETIRO',valorNovedad:13000,diasNovedad:13,tipoNovedadAnterior:'INGRESO',valorNovedadAnterior:30000,diasNovedadAnterior:30};
add('Client withdraws insured','client','clientPolicies/own/insuredPeople/example','update',person,retired);
add('Client restores status only','client','clientPolicies/own/insuredPeople/example','update',retired,{...retired,estado:'ACTIVO',fechaDesvinculacion:null});
add('Client fully restores original novelty','client','clientPolicies/own/insuredPeople/example','update',retired,{...retired,...person});
add('Client undoes new inclusion','client','clientPolicies/own/insuredPeople/example','delete',person);
add('Client confirms month','client','clientChangeNotifications/example','create',null,{clientUid:'simulated-client',policyId:'own',status:'PENDING',action:'confirm_month'});
add('Client denied self promotion','client','users/simulated-client','update',{isPlatformSuperAdmin:false},{isPlatformSuperAdmin:true},'DENY');
add('Anonymous denied clients','anonymous','clients/example','get',{},null,'DENY');
add('Admin creates another user profile','admin','users/new-user','create',null,{isPlatformSuperAdmin:false,status:'ACTIVE'});
add('Admin creates company membership','admin','companies/abp/memberships/new-user','create',null,{role:'USUARIO',status:'ACTIVE'});
add('Client denied membership promotion','client','companies/abp/memberships/simulated-client','update',{role:'USUARIO'},{role:'ADMIN_EMPRESA'},'DENY');
add('Client denied accounting','client','vouchers/example','get',{},null,'DENY');
add('Client denied modifying policy ownership','client','clientPolicies/own','update',{clientUid:'simulated-client'},{clientUid:'simulated-other'},'DENY');
add('Client denied negative monthly premium','client','clientPolicies/own/insuredPeople/example','update',person,{...person,valorMensual:-1},'DENY');
add('Client creates change notification','client','clientChangeNotifications/example','create',null,{clientUid:'simulated-client',policyId:'own',status:'PENDING',action:'update'});
add('Client denied notification for other policy','client','clientChangeNotifications/example','create',null,{clientUid:'simulated-client',policyId:'other',status:'PENDING',action:'update'},'DENY');
add('Staff creates ABP client','staff','clients/example','create',null,{companyId:'abp'});
add('Staff denied other company client','staff','clients/example','get',{companyId:'other'},null,'DENY');
add('Staff denied transferring client','staff','clients/example','update',{companyId:'abp'},{companyId:'other'},'DENY');
add('Staff creates activity','staff','activities/example','create',null,{companyId:'abp'});
add('Staff reads activity','staff','activities/example','get',{companyId:'abp'});
add('Staff denied accounting','staff','vouchers/example','get',{},null,'DENY');
add('Staff denied creating user profiles','staff','users/new-user','create',null,{isPlatformSuperAdmin:false},'DENY');
add('Client denied internal clients','client','clients/example','get',{companyId:'abp'},null,'DENY');
add('Client denied internal activities','client','activities/example','create',null,{companyId:'abp'},'DENY');
add('Restore denied arbitrary premium','client','clientPolicies/own/insuredPeople/example','update',retired,{...retired,...person,valorNovedad:999999},'DENY');
add('Restore denied changing identity','client','clientPolicies/own/insuredPeople/example','update',retired,{...retired,...person,cedula:'OTHER'},'DENY');
add('Staff reads team memberships','staff','companies/abp/memberships/example','list',{});
add('Client denied team directory','client','users','list',{},null,'DENY');
add('Inactive adviser denied clients','inactive-staff','clients/example','get',{companyId:'abp'},null,'DENY');
add('Inactive adviser denied activities','inactive-staff','activities/example','create',null,{companyId:'abp'},'DENY');
add('Staff denied editing memberships','staff','companies/abp/memberships/simulated-staff','update',{role:'ASESOR'},{role:'ADMIN_EMPRESA'},'DENY');
add('Staff denied commissions','staff','companies/abp/commissions/example','get',{},null,'DENY');
add('Anonymous denied creating activities','anonymous','activities/example','create',null,{companyId:'abp'},'DENY');
add('Admin denied rewriting voucher audit','admin','vouchers/example/edits/example','update',{companyId:'abp'},{companyId:'abp',changed:true},'DENY');
const legacyRetired={...person,estado:'DESVINCULADO',fechaDesvinculacion:'2026-08-19',tipoNovedad:'RETIRO'};
add('Legacy restore clears unknown novelty','client','clientPolicies/own/insuredPeople/example','update',legacyRetired,{...legacyRetired,estado:'ACTIVO',fechaDesvinculacion:null,tipoNovedad:null,valorNovedad:null,diasNovedad:null});
const local = process.argv.includes('--local');
const production = process.argv.includes('--production');
const rulesPath = production ? directory+'production-current.rules' : local ? directory+'../firestore.rules' : directory+'deployed-firestore.rules';
const response = await fetch('https://firebaserules.googleapis.com/v1/projects/abp-agencia-de-seguros:test', {
  method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
  body:JSON.stringify({source:{files:[{name:'firestore.rules',content:fs.readFileSync(rulesPath,'utf8')}]},testSuite:{testCases:cases.map(c=>c.test)}}),
  signal:AbortSignal.timeout(45000),
});
const result = await response.json();
if (!response.ok) {console.log('Simulation API:',response.status,JSON.stringify(result));process.exitCode=1;}
else {
  const report = {date:new Date().toISOString(),rulesPath,method:'Firebase Rules projects.test; all document lookups mocked',issues:result.issues,tests:(result.testResults||[]).map((r,i)=>({label:cases[i].label,expectation:cases[i].test.expectation,...r}))};
  fs.writeFileSync(directory+(production?'rules-production-results.json':local?'rules-fixed-results.json':'rules-simulation-results.json'),JSON.stringify(report,null,2));
  for(const test of report.tests) console.log(test.state+': '+test.label);
  console.log('Total:',report.tests.length,'success:',report.tests.filter(t=>t.state==='SUCCESS').length,'failure:',report.tests.filter(t=>t.state!=='SUCCESS').length);
  if (report.issues?.some(i=>i.severity==='ERROR') || report.tests.length!==cases.length || report.tests.some(t=>t.state!=='SUCCESS')) process.exitCode=1;
}
