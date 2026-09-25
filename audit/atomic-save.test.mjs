import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Execute the actual save handlers with an in-memory Firestore boundary.
// Writes are buffered until commit; injected failures reproduce partial-save risks.
function handler(path, context) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const start = source.indexOf('  const save = async (e) => {');
  assert.ok(start >= 0);
  const end = source.indexOf('\n  };', start);
  const fn = source.slice(start + '  const save = '.length, end + 4);
  return new Function(...Object.keys(context), `return (${fn});`)(...Object.values(context));
}
function firestore(failure = '') {
  const records = new Map();
  let next = 0, commits = 0;
  const snapshot = path => ({ exists:()=>records.has(path), data:()=>structuredClone(records.get(path)) });
  const api = {
    db: {},
    doc: (base,...parts)=>parts.length ? parts.join('/') : {path:`${base.path}/new-${++next}`,id:`new-${next}`},
    collection: (_db,...parts)=>({path:parts.join('/')}),
    getDoc: async path=>snapshot(path),
    getDocFromServer: async path=>{if(failure==='unknown')throw Error('Offline');return snapshot(path);},
    getDocs: async ref=>({docs:[...records].filter(([path])=>path.startsWith(ref.path+'/')&&path.split('/').length===ref.path.split('/').length+1).map(([path,data])=>({id:path.split('/').at(-1),data:()=>structuredClone(data)}))}),
    serverTimestamp: ()=>'timestamp',
    writeBatch: ()=>{
      const changes=[];
      return {
        set:(path,data,options)=>changes.push([path.path||path,data,!!options?.merge]),
        update:(path,data)=>changes.push([path,data,true]),
        commit:async()=>{
          commits++;
          if(failure==='reject'||failure==='unknown')throw Error('Commit rejected');
          for(const [path,data,merge] of changes)records.set(path,merge?{...records.get(path),...data}:data);
          if(failure==='ambiguous')throw Error('Response lost after commit');
        },
      };
    },
  };
  return {api,records,commits:()=>commits};
}
const noop=()=>{};
function voucher(failure='',editing=true) {
  const db=firestore(failure);
  db.records.set('vouchers/existing',{concept:'Before',status:'POSTED'});
  db.records.set('vouchers/existing/lines/003',{debit:100,credit:0});
  const errors=[];
  const context={...db.api,console:{error:noop},setError:e=>errors.push(e),setSaving:noop,setView:noop,resetDraft:noop,
    editingId:editing?'existing':null,editingStatus:'POSTED',companyId:'abp',userId:'admin',validate:()=>[],
    totals:{debit:100,credit:100},draft:{type:'DIARIO',date:'2026-09-17',period:'2026-09',concept:'After',lines:[{accountId:'a',accountCode:'1',accountName:'A',debit:100,credit:0},{accountId:'b',accountCode:'2',accountName:'B',debit:0,credit:100}]}};
  return {...db,errors,save:handler('../src/modules/accounting/VouchersPage.jsx',context)};
}
test('rejected voucher edit preserves header, lines and audit together',async()=>{
  const t=voucher('reject');const before=structuredClone([...t.records]);
  await t.save({preventDefault:noop});
  assert.deepEqual([...t.records],before);assert.equal(t.commits(),1);assert.ok(t.errors.at(-1));
});
test('voucher edit commits header, audit, replacement lines and obsolete lines once',async()=>{
  const t=voucher();await t.save({preventDefault:noop});
  assert.equal(t.commits(),1);assert.equal(t.records.get('vouchers/existing').concept,'After');
  assert.equal(t.records.get('vouchers/existing/lines/003').voided,true);
  assert.equal(t.records.get('vouchers/existing/lines/001').debit,100);
  assert.equal([...t.records.keys()].filter(p=>p.includes('/edits/')).length,1);
});
test('new voucher is posted with its lines in the same commit',async()=>{
  const t=voucher('',false);await t.save({preventDefault:noop});
  assert.equal(t.commits(),1);assert.equal(t.records.get('vouchers/new-1').status,'POSTED');
  assert.ok(t.records.has('vouchers/new-1/lines/002'));
});
function user(failure='') {
  const db=firestore(failure);const deleted=[],errors=[],uids=[];
  const context={...db.api,console:{error:noop},setError:e=>errors.push(e),setInfo:noop,setSaving:noop,setIsEditorOpen:noop,
    setUid:uid=>uids.push(uid),setGeneratedUid:noop,normalizeUid:uid=>(uid||'').trim(),uid:'',companyId:'abp',
    email:'simulation@example.invalid',password:'simulation-password',displayName:'Simulation',isPlatformSuperAdmin:false,userStatus:'ACTIVE',policyType:'NINGUNA',currentUserId:'admin',role:'USUARIO',membershipStatus:'ACTIVE',
    createUserInAuth:async()=>({uid:'new-user',idToken:'synthetic-token'}),FIREBASE_API_KEY:'synthetic',
    fetch:async(_url,options)=>{deleted.push(JSON.parse(options.body).idToken);return {ok:true};}};
  return {...db,deleted,errors,uids,save:handler('../src/UsersAdmin.jsx',context)};
}
test('new user profile and membership commit together',async()=>{
  const t=user();await t.save({preventDefault:noop});
  assert.equal(t.commits(),1);assert.ok(t.records.has('users/new-user'));
  assert.ok(t.records.has('companies/abp/memberships/new-user'));assert.deepEqual(t.deleted,[]);
});
test('failed user provisioning rolls back only the newly created Auth account',async()=>{
  const t=user('reject');await t.save({preventDefault:noop});
  assert.equal(t.records.size,0);assert.deepEqual(t.deleted,['synthetic-token']);assert.equal(t.uids.at(-1),'');
});
test('lost commit response preserves a successfully provisioned account',async()=>{
  const t=user('ambiguous');await t.save({preventDefault:noop});
  assert.equal(t.records.size,2);assert.deepEqual(t.deleted,[]);assert.equal(t.uids.at(-1),'new-user');
});
test('offline verification preserves the UID and never deletes an uncertain account',async()=>{
  const t=user('unknown');await t.save({preventDefault:noop});
  assert.deepEqual(t.deleted,[]);assert.equal(t.uids.at(-1),'new-user');assert.match(t.errors.at(-1),/No se pudo confirmar/);
});
