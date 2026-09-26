// v2.5: official KPM form fields + section-aware PDF stamping for all 11 instruments.
import { createClient } from 'https://esm.sh/@neondatabase/neon-js';


const neon = createClient(window.PK_CONFIG.NEON_DATABASE_URL, { auth: { allowAnonymous: true } });

function safeStoredJson(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(_){
    localStorage.removeItem(key);
    return fallback;
  }
}

const state = {
  token: localStorage.getItem('pk_token') || '',
  user: safeStoredJson('pk_user',null),
  boot: null,
  assignments: safeStoredJson('pk_assignments',[]),
  route: 'assignments',
  currentAssignment: null,
  currentSubmission: null,
  currentItems: [],
  currentResponses: {},
  saveTimer: null,
  signatureHasInk: false,
  currentMetadata: {},
  metaSaveTimer: null,
  submissionFilter: 'ALL'
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg){
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  $('#toast').appendChild(el); setTimeout(()=>el.remove(),3500);
}

function dismissBootSplash(){
  const el=document.getElementById('bootSplash');
  if(!el) return;
  el.classList.add('hide');
  setTimeout(()=>el.remove(),220);
}

function ensureLoader(){
  let el=$('#globalLoader');
  if(el) return el;
  el=document.createElement('div');
  el.id='globalLoader';
  el.className='global-loader hidden';
  el.innerHTML=`<div class="loader-card">
    <div class="loader-orbit">
      <div class="loader-ring ring-a"></div>
      <div class="loader-ring ring-b"></div>
      <div class="loader-ring ring-c"></div>
      <div class="loader-spark spark-a"></div>
      <div class="loader-spark spark-b"></div>
      <div class="loader-logo-wrap">
        <img src="https://i.postimg.cc/3RF9M05N/Logo-SKSA.png" alt="Logo SKSA" class="loader-logo">
      </div>
    </div>
    <div class="loader-text">
      <strong id="globalLoaderTitle">Memuatkan Sistem…</strong>
      <span id="globalLoaderDesc">Sila tunggu sebentar.</span>
    </div>
  </div>`;
  document.body.appendChild(el);
  return el;
}

function showLoader(title='Memuatkan Sistem…', desc='Sila tunggu sebentar.'){
  const el=ensureLoader();
  $('#globalLoaderTitle',el).textContent=title;
  $('#globalLoaderDesc',el).textContent=desc;
  el.classList.remove('hidden');
}

function hideLoader(){
  const el=$('#globalLoader');
  if(el) el.classList.add('hidden');
}

async function rpc_(fn,args={}){
  const {data,error}=await neon.rpc(fn,args);
  if(error){
    console.error('Neon RPC',fn,error);
    throw new Error(error.message||'Ralat pangkalan data.');
  }
  return data;
}

async function get(action, params={}, opts={}){
  const {loading=false,title='Memuatkan Sistem…',desc='Sila tunggu sebentar.'}=opts||{};
  if(loading) showLoader(title,desc);
  try{
    if(action==='bootstrap') return await rpc_('pk_bootstrap',{p_token:state.token});
    if(action==='dashboard') return await rpc_('pk_dashboard',{p_token:state.token});
    if(action==='assignments') return await rpc_('pk_assignments',{p_token:state.token});
    if(action==='staff') return await rpc_('pk_admin_staff',{p_token:state.token});
    if(action==='bundles') return await rpc_('pk_bundle_data',{p_token:state.token});
    if(action==='submissions') return await rpc_('pk_admin_submissions',{p_token:state.token});
    if(action==='admin_assignments') return await rpc_('pk_admin_assignments',{p_token:state.token});
    if(action==='followups') return await rpc_('pk_admin_followups',{p_token:state.token});
    if(action==='submission_detail') return await rpc_('pk_submission_detail',{p_token:state.token,p_submission_id:params.submission_id});
    return {ok:false,error:'UNKNOWN_ACTION',action};
  }finally{
    if(loading) hideLoader();
  }
}

async function post(action,payload={},opts={}){
  const {loading=false,title='Memuatkan Sistem…',desc='Sila tunggu sebentar.'}=opts||{};
  if(loading) showLoader(title,desc);
  try{
    if(action==='login_ic') return await rpc_('pk_login',{p_ic:payload.ic});
    if(action==='open_assignment') return await rpc_('pk_open_assignment',{p_token:state.token,p_assignment_id:payload.assignment_id});
    if(action==='save_responses') return await rpc_('pk_save_responses',{
      p_token:state.token,
      p_assignment_id:payload.assignment_id,
      p_submission_id:payload.submission_id||null,
      p_responses:payload.responses||[]
    });
    if(action==='save_metadata') return await rpc_('pk_save_metadata',{
      p_token:state.token,
      p_assignment_id:payload.assignment_id,
      p_submission_id:payload.submission_id||null,
      p_metadata:payload.metadata||{}
    });
    if(action==='submit_submission') return await rpc_('pk_submit',{
      p_token:state.token,
      p_submission_id:payload.submission_id,
      p_signer_name:payload.nama_penandatangan,
      p_signature_data_url:payload.signature_data||''
    });
    if(action==='upsert_staff') return await rpc_('pk_upsert_staff',{
      p_token:state.token,p_staff_id:payload.staff_id||null,p_nama:payload.nama||'',p_email:payload.email||'',
      p_jawatan:payload.jawatan_hakiki||'',p_panitia:payload.panitia||'',p_ic:payload.ic||'',
      p_is_admin:!!payload.is_admin,p_aktif:payload.aktif!==false
    });
    if(action==='save_bundle') return await rpc_('pk_save_bundle',{
      p_token:state.token,p_bundle_id:payload.bundle_id||null,p_nama_bundle:payload.nama_bundle||'',
      p_keterangan:payload.keterangan||'',p_aktif:payload.aktif!==false,p_carry_forward:payload.carry_forward!==false,
      p_member_ids:payload.member_ids||[],p_instrument_ids:payload.instrument_ids||[]
    });
    if(action==='deactivate_bundle') return await rpc_('pk_deactivate_bundle',{p_token:state.token,p_bundle_id:payload.bundle_id});
    if(action==='create_assignment') return await rpc_('pk_create_assignment',{
      p_token:state.token,p_staff_id:payload.staff_id,p_instrument_id:payload.instrument_id,
      p_cycle_id:payload.cycle_id||null,p_due_date:payload.tarikh_akhir||null
    });
    if(action==='reopen_submission') return await rpc_('pk_reopen_submission',{p_token:state.token,p_submission_id:payload.submission_id});
    if(action==='delete_submission') return await rpc_('pk_delete_submission_secure',{p_token:state.token,p_submission_id:payload.submission_id,p_ic:payload.ic||''});
    if(action==='open_year') return await rpc_('pk_open_year',{p_token:state.token,p_year:Number(payload.tahun)});
    return {ok:false,error:'UNKNOWN_ACTION',action};
  }finally{
    if(loading) hideLoader();
  }
}


const INSTRUMENT_REQUIREMENTS = {
  'PBD-A': {metaTitle:'BAHAGIAN A: MAKLUMAT PENGETUA/GURU BESAR/GURU PENOLONG KANAN',fields:['subject_taught','year_form']},
  'PBD-B': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU KANAN MATA PELAJARAN/KETUA PANITIA',fields:['subject_taught','year_form']},
  'PBD-C': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU MATA PELAJARAN',fields:['subject_taught','year_form']},
  'PPSI-A': {metaTitle:'BAHAGIAN A: MAKLUMAT PENGETUA/GURU BESAR',fields:[]},
  'PPSI-B': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU PENOLONG KANAN HAL EHWAL MURID',fields:[]},
  'PPSI-C': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU BIMBINGAN DAN KAUNSELING/GURU BIMBINGAN LANTIKAN DALAMAN',fields:[]},
  'PAJSK-A': {metaTitle:'BAHAGIAN A: MAKLUMAT PENGETUA/GURU BESAR/GURU PENOLONG KANAN',fields:['school_name']},
  'PAJSK-B': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU MATA PELAJARAN',fields:['kokurikulum_unit']},
  'SEGAK-A': {metaTitle:'BAHAGIAN A: MAKLUMAT PENGETUA/GURU BESAR/GURU PENOLONG KANAN PENTADBIRAN',fields:['school_name','school_code','role_option','scope'],roles:['PENGETUA','GURU BESAR','GURU PENOLONG KANAN PENTADBIRAN']},
  'SEGAK-B': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU KANAN MATA PELAJARAN/KETUA PANITIA PENDIDIKAN JASMANI DAN PENDIDIKAN KESIHATAN',fields:['school_name','school_code','role_option','scope'],roles:['GURU KANAN MATA PELAJARAN','KETUA PANITIA']},
  'SEGAK-C': {metaTitle:'BAHAGIAN A: MAKLUMAT GURU MATA PELAJARAN PJPK/GURU PRASEKOLAH/GURU PPKI',fields:['school_name','school_code','role_option','scope'],roles:['GMP PJPK','GURU PRASEKOLAH','GURU PPKI']}
};

const META_LABELS = {
  subject_taught:'Mata Pelajaran Diajar',
  year_form:'Tahun/Tingkatan',
  school_name:'Nama Sekolah',
  school_code:'Kod Sekolah',
  role_option:'Jawatan',
  scope:'Skop Pelaksanaan',
  kokurikulum_unit:'Kelab Persatuan / Sukan Permainan / Pasukan Badan Beruniform'
};

const SEGAK_SCOPE_OPTIONS = [
  ['SEGAK_SM','SEGAK - SM'],['SEGAK_SR','SEGAK - SR'],['BMI_SR','BMI 5-9T - SR'],
  ['BMI_PRASEKOLAH','BMI 5-9T - Prasekolah'],['BMI_PPKI','BMI 5-9T - PPKI']
];

function defaultMetadata(instrumentId,existing={}){
  const m={...(existing||{})};
  const fields=INSTRUMENT_REQUIREMENTS[instrumentId]?.fields||[];

  // Maklumat sekolah adalah tetap untuk semua instrumen SK Sungai Abong.
  // Sentiasa override nilai lama supaya tiada variasi ejaan/kod dalam borang.
  if(fields.includes('school_name')){
    m.school_name=window.PK_CONFIG.SCHOOL_OFFICIAL_NAME||'SEKOLAH KEBANGSAAN SUNGAI ABONG';
  }
  if(fields.includes('school_code')){
    m.school_code=window.PK_CONFIG.SCHOOL_CODE||'JBA5095';
  }

  if(instrumentId.startsWith('SEGAK-') && !Array.isArray(m.scope)) m.scope=[];
  return m;
}

function sectionInstructionHtml(bahagian){
  if(bahagian==='B') return `<div class="official-instruction"><b>ARAHAN BAHAGIAN B</b><div>i. Tandakan (√) pada ruangan <b>Ya</b> atau <b>Tidak</b>.</div><div>ii. Bulatkan skala penilaian: <b>1</b> Sangat Tidak Menguasai/Memahami · <b>2</b> Tidak Menguasai/Memahami · <b>3</b> Kurang Menguasai/Memahami · <b>4</b> Menguasai/Memahami · <b>5</b> Sangat Menguasai/Memahami.</div></div>`;
  if(bahagian==='C') return `<div class="official-instruction"><b>ARAHAN BAHAGIAN C</b><div>i. Tandakan (√) pada ruangan <b>Ya</b> atau <b>Tidak</b>.</div><div>ii. Bulatkan skala penilaian: <b>1</b> Tidak pernah · <b>2</b> Jarang-jarang · <b>3</b> Kadang-kadang · <b>4</b> Kerap · <b>5</b> Sangat kerap.</div></div>`;
  return '';
}

function renderMetadataCard(a,locked){
  const id=a.instrument_id;
  const req=INSTRUMENT_REQUIREMENTS[id]||{metaTitle:'BAHAGIAN A: MAKLUMAT PERSONEL',fields:[]};
  const m=state.currentMetadata||{};
  const dis=locked?'disabled':'';
  const fieldHtml=[];
  fieldHtml.push(`<div><label>Nama</label><input disabled value="${esc(state.user?.nama||'')}"></div>`);
  fieldHtml.push(`<div><label>Jawatan</label><input disabled value="${esc(state.user?.jawatan_hakiki||'')}"></div>`);

  for(const f of req.fields){
    if(f==='subject_taught') fieldHtml.push(`<div><label>Mata Pelajaran Diajar <span class="req">*</span></label><input ${dis} data-meta="subject_taught" value="${esc(m.subject_taught||'')}" placeholder="Contoh: Bahasa Inggeris"></div>`);
    else if(f==='year_form') fieldHtml.push(`<div><label>Tahun/Tingkatan <span class="req">*</span></label><input ${dis} data-meta="year_form" value="${esc(m.year_form||'')}" placeholder="Contoh: Tahun 3 / Tahun 4"></div>`);
    else if(f==='school_name') fieldHtml.push(`<div><label>${id==='PAJSK-A'?'Sekolah':'Nama Sekolah'} <span class="auto-tag">AUTO</span></label><input readonly data-meta="school_name" value="${esc(window.PK_CONFIG.SCHOOL_OFFICIAL_NAME||'SEKOLAH KEBANGSAAN SUNGAI ABONG')}" title="Diisi automatik oleh sistem"></div>`);
    else if(f==='school_code') fieldHtml.push(`<div><label>Kod Sekolah <span class="auto-tag">AUTO</span></label><input readonly data-meta="school_code" value="${esc(window.PK_CONFIG.SCHOOL_CODE||'JBA5095')}" title="Diisi automatik oleh sistem"></div>`);
    else if(f==='kokurikulum_unit') fieldHtml.push(`<div class="meta-wide"><label>Kelab Persatuan / Sukan Permainan / Pasukan Badan Beruniform <span class="req">*</span></label><input ${dis} data-meta="kokurikulum_unit" value="${esc(m.kokurikulum_unit||'')}" placeholder="Contoh: Pengakap / Bola Jaring / Kelab Keselamatan Jalan Raya"></div>`);
    else if(f==='role_option') fieldHtml.push(`<div><label>Jawatan Dalam Instrumen <span class="req">*</span></label><select ${dis} data-meta="role_option"><option value="">-- Pilih --</option>${(req.roles||[]).map(x=>`<option value="${esc(x)}" ${String(m.role_option||'')===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`);
    else if(f==='scope') fieldHtml.push(`<div class="meta-wide"><label>Skop Pelaksanaan <span class="req">*</span></label><div class="scope-grid">${SEGAK_SCOPE_OPTIONS.map(([v,l])=>`<label class="scope-option"><input ${dis} type="checkbox" data-meta-scope="${esc(v)}" ${(m.scope||[]).includes(v)?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div></div>`);
  }

  return `<div class="card metadata-card"><div class="section-title" style="margin-top:0"><h2>${esc(req.metaTitle)}</h2></div><div class="meta-form-grid">${fieldHtml.join('')}</div><div class="muted meta-note">Maklumat sekolah bertanda AUTO diisi tetap oleh sistem. Maklumat bertanda * perlu dilengkapkan oleh pemilik instrumen sebelum hantar.</div></div>`;
}

function collectMetadataFromDom(){
  const m={...(state.currentMetadata||{})};
  $$('[data-meta]').forEach(el=>m[el.dataset.meta]=el.value.trim());
  const scopes=$$('[data-meta-scope]:checked').map(el=>el.dataset.metaScope);
  if($$('[data-meta-scope]').length) m.scope=scopes;

  const fields=INSTRUMENT_REQUIREMENTS[state.currentAssignment?.instrument_id]?.fields||[];
  if(fields.includes('school_name')) m.school_name=window.PK_CONFIG.SCHOOL_OFFICIAL_NAME||'SEKOLAH KEBANGSAAN SUNGAI ABONG';
  if(fields.includes('school_code')) m.school_code=window.PK_CONFIG.SCHOOL_CODE||'JBA5095';

  state.currentMetadata=m;
  return m;
}

function handleMetadataChange(){
  collectMetadataFromDom();
  const ss=$('#saveState'); if(ss) ss.textContent='Belum disimpan…';
  clearTimeout(state.metaSaveTimer);
  state.metaSaveTimer=setTimeout(saveCurrentMetadata,650);
}

async function saveCurrentMetadata(){
  if(!state.currentAssignment) return {ok:true};
  const metadata=collectMetadataFromDom();
  const payload={assignment_id:state.currentAssignment.assignment_id,metadata};
  if(state.currentSubmission?.submission_id) payload.submission_id=state.currentSubmission.submission_id;
  const out=await post('save_metadata',payload);
  if(out.ok && out.submission_id){
    if(!state.currentSubmission) state.currentSubmission={submission_id:out.submission_id,status:'DRAFT',metadata:out.metadata||metadata};
    else state.currentSubmission={...state.currentSubmission,metadata:out.metadata||metadata};
  }
  const ss=$('#saveState'); if(ss) ss.textContent=out.ok?'Disimpan':'Gagal simpan';
  return out;
}

function missingMetadataFields(instrumentId,meta){
  const req=INSTRUMENT_REQUIREMENTS[instrumentId]?.fields||[];
  const missing=[];
  for(const f of req){
    if(f==='school_name' || f==='school_code') continue;
    if(f==='scope'){if(!Array.isArray(meta.scope)||!meta.scope.length) missing.push(f);}
    else if(!String(meta[f]||'').trim()) missing.push(f);
  }
  return missing;
}

function setSession(data){
  state.token=data.token;
  state.user=data.user;
  state.assignments=Array.isArray(data.assignments)?data.assignments:[];
  localStorage.setItem('pk_token',data.token);
  localStorage.setItem('pk_user',JSON.stringify(data.user));
  localStorage.setItem('pk_assignments',JSON.stringify(state.assignments));
}

function logout(){
  state.token=''; state.user=null; state.boot=null; state.assignments=[];
  localStorage.removeItem('pk_token'); localStorage.removeItem('pk_user'); localStorage.removeItem('pk_assignments');
  renderLogin();
}

async function start(){
  try{
    if(!state.token || !state.user){
      renderLogin();
      requestAnimationFrame(dismissBootSplash);
      return;
    }

    state.route='assignments';
    renderShell();
    requestAnimationFrame(dismissBootSplash);

    refreshAssignments(true).catch(()=>{
      logout();
    });
  }catch(err){
    console.error(err);
    renderFatal('Ralat memulakan sistem. Sila refresh semula.');
    dismissBootSplash();
  }
}

async function loadBoot(){
  const b=await get('bootstrap');
  if(!b.ok) throw new Error(b.message||b.error);
  state.boot=b;
}

function renderFatal(msg){
  $('#app').innerHTML=`<div class="login-page"><div class="login-card"><h1>Ralat Sambungan</h1><p>${esc(msg)}</p></div></div>`;
}

async function renderLogin(){
  $('#app').innerHTML=`<div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <img class="school-logo" src="https://i.postimg.cc/3RF9M05N/Logo-SKSA.png" alt="Logo SK Sungai Abong">
      </div>
      <h1>Log Masuk</h1>
      <p class="system-title"><span>SISTEM DIGITAL</span><span>PENJAMINAN KUALITI</span><span>SK SG ABONG</span></p>
      <form id="loginForm" class="stack">
        <div>
          <label>No. Kad Pengenalan</label>
          <input id="ic" inputmode="numeric" autocomplete="off" maxlength="14"
                 placeholder="Contoh: 850110045025" required>
        </div>
        <button class="btn btn-primary" type="submit">Masuk</button>
      </form>
    </div>
  </div>`;
  dismissBootSplash();

  const icInput=$('#ic');
  icInput.oninput=()=>{
    const digits=icInput.value.replace(/\D/g,'').slice(0,12);
    icInput.value=digits;
  };

  $('#loginForm').onsubmit=async e=>{
    e.preventDefault();
    const ic=icInput.value.replace(/\D/g,'');
    if(ic.length!==12){toast('Masukkan 12 digit No. Kad Pengenalan.');return}
    const btn=$('#loginForm button[type="submit"]');
    btn.disabled=true; btn.textContent='Menyemak…';
    let out;
    try{
      out=await post('login_ic',{ic},{loading:true,title:'Mengesahkan Identiti…',desc:'Sedang menyemak No. Kad Pengenalan anda.'});
    }catch(err){
      btn.disabled=false; btn.textContent='Masuk';
      toast('Sambungan backend lambat/gagal. Cuba semula.');
      return;
    }
    if(!out.ok){
      btn.disabled=false; btn.textContent='Masuk';
      toast(out.message||'No. Kad Pengenalan tidak dijumpai.');
      return;
    }
    setSession(out);
    state.route='assignments';
    renderShell();
  };
}

function renderShell(){
  const admin=state.user?.is_admin;
  $('#app').innerHTML=`<div class="shell">
    <aside class="sidebar">
      <div class="brand">${esc(window.PK_CONFIG.APP_NAME)}<small>${esc(window.PK_CONFIG.SCHOOL_NAME)}</small></div>
      <div class="nav">
        <button data-route="assignments">Instrumen Saya</button>
        ${admin?`<button data-route="dashboard">Dashboard</button>
        <button data-route="staff">Guru</button>
        <button data-route="bundles">Bundle Peranan</button>
        <button data-route="adminAssignments">Tugasan Manual</button>
        <button data-route="submissions">Hantaran</button>
        <button data-route="followups">Tindakan Susulan</button>
        <button data-route="settings">Tahun / Tetapan</button>`:''}
        <button id="logoutBtn">Log Keluar</button>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <h1 id="pageTitle"></h1>
        <div class="userbox"><b>${esc(state.user.nama)}</b><br>${esc(state.user.jawatan_hakiki||'')}</div>
      </div>
      <div id="view"></div>
    </main>
  </div>`;

  $$('.nav button[data-route]').forEach(b=>b.onclick=()=>go(b.dataset.route));
  $('#logoutBtn').onclick=logout;
  go(state.route||'dashboard');
}

function go(route){
  state.route=route;
  $$('.nav button[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===route));
  if(route==='dashboard') return viewDashboard();
  if(route==='assignments') return viewAssignments();
  if(route==='staff') return viewStaff();
  if(route==='bundles') return viewBundles();
  if(route==='adminAssignments') return viewAdminAssignments();
  if(route==='submissions') return viewSubmissions();
  if(route==='followups') return viewFollowups();
  if(route==='settings') return viewSettings();
}

function title(t){ $('#pageTitle').textContent=t; }

async function viewDashboard(){
  title('Dashboard');
  if(!state.boot) await loadBoot();
  const d=await get('dashboard');
  const s=d.stats||{};
  $('#view').innerHTML=`<div class="grid grid4">
    ${stat('Tugasan',s.assignments||0,'adminAssignments')}
    ${stat('Selesai',s.submitted||0,'submissions','SUBMITTED')}
    ${stat('Draf',s.draft||0,'submissions','DRAFT')}
    ${stat('Tindakan Susulan',s.open_followups||0,'followups')}
  </div>
  <div class="section-title"><h2>Sesi Aktif</h2></div>
  <div class="card dashboard-session" data-dashboard-route="settings">
    <b>${esc(state.boot.active_session?.nama||state.boot.active_session?.name||'-')}</b>
    <p class="muted">Tahun aktif: ${esc(state.boot.config.TAHUN_AKTIF||'-')}</p>
    <div class="toolbar">
      <button class="btn btn-primary" id="openMyInstruments">Buka Instrumen Saya</button>
      <span class="muted">Klik kad sesi untuk buka Tahun / Tetapan.</span>
    </div>
  </div>`;

  $$('[data-dashboard-route]').forEach(el=>el.onclick=e=>{
    // Hanya abaikan klik butang "Buka Instrumen Saya" yang berada dalam kad Sesi.
    // Kad statistik sendiri ialah <button>, jadi jangan tapis semua button.
    if(e.target.closest('#openMyInstruments')) return;

    const route=el.dataset.dashboardRoute;
    const filter=el.dataset.dashboardFilter||'ALL';

    if(route==='submissions') state.submissionFilter=filter;
    else state.submissionFilter='ALL';

    go(route);
  });

  $('#openMyInstruments').onclick=e=>{
    e.stopPropagation();
    go('assignments');
  };
}

function stat(label,value,route,filter='ALL'){
  return `<button class="card stat stat-link" data-dashboard-route="${esc(route)}" data-dashboard-filter="${esc(filter)}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>Klik untuk buka</small></button>`;
}

async function viewAssignments(){
  title('Instrumen Saya');

  // Papar cache terus supaya pengguna tak nampak skrin kosong.
  renderAssignmentRows(state.assignments || []);

  // Refresh dari backend selepas UI sudah keluar.
  await refreshAssignments(false);
}

function renderAssignmentRows(rows){
  const view=$('#view');
  if(!view) return;

  if(rows.length===1 && !(rows[0].submission?.status==='SUBMITTED')){
    view.innerHTML=`<div class="card loading-card">
      <div class="spinner"></div>
      <b>Membuka instrumen…</b>
      <span class="muted">${esc(rows[0].instrument?.tajuk||rows[0].instrument_id)}</span>
    </div>`;
    openAssignment(rows[0].assignment_id,rows);
    return;
  }

  view.innerHTML=`<div class="stack" id="assignmentList">
    ${rows.length?rows.map(a=>{
      const st=a.submission?.status||a.status||'OPEN';
      const sid=a.submission?.submission_id||'';
      return `<div class="assignment">
        <div><h3>${esc(a.instrument?.tajuk||a.instrument_id)}</h3>
        <p>${esc(a.instrument_id)} · ${esc(a.cycle_id||'')}</p></div>
        <div class="toolbar">
          <span class="badge ${st==='SUBMITTED'?'ok':st==='DRAFT'?'warn':'gray'}">${esc(st)}</span>
          ${st==='SUBMITTED'&&sid?`<button class="btn btn-light" data-pdf="${esc(sid)}">Muat Turun PDF</button>`:''}
          <button class="btn btn-primary" data-open="${esc(a.assignment_id)}">${st==='SUBMITTED'?'Lihat':'Isi'}</button>
          ${st==='SUBMITTED'&&sid?`<button class="btn btn-light btn-update" data-reopen="${esc(sid)}" data-assignment="${esc(a.assignment_id)}">KEMASKINI</button>`:''}
          ${sid?`<button class="btn btn-danger" data-delete-sub="${esc(sid)}">PADAM</button>`:''}
        </div>
      </div>`;
    }).join(''):`<div class="card muted">Belum ada tugasan instrumen untuk anda.</div>`}
  </div>`;
  $$('[data-open]').forEach(b=>b.onclick=()=>openAssignment(b.dataset.open,rows));
  $$('[data-pdf]').forEach(b=>b.onclick=()=>downloadSubmissionPdf(b.dataset.pdf));
  $$('[data-reopen]').forEach(b=>b.onclick=()=>reopenOwnSubmission(b.dataset.reopen,b.dataset.assignment));
  $$('[data-delete-sub]').forEach(b=>b.onclick=()=>requestDeleteSubmission(b.dataset.deleteSub,()=>viewAssignments()));
}

async function refreshAssignments(silent=false){
  const out=await get('assignments',{}, silent?{}:{loading:true,title:'Memuatkan Instrumen…',desc:'Sedang mendapatkan tugasan instrumen anda.'});
  if(!out.ok) throw new Error(out.message||out.error||'Gagal memuat tugasan.');
  state.assignments=out.assignments||[];
  localStorage.setItem('pk_assignments',JSON.stringify(state.assignments));

  if(state.route==='assignments'){
    renderAssignmentRows(state.assignments);
  }
  return state.assignments;
}

async function openAssignment(id,rows){
  const cached=(rows||state.assignments||[]).find(x=>x.assignment_id===id);
  if(cached) state.currentAssignment=cached;

  const view=$('#view');
  if(view){
    view.innerHTML=`<div class="card loading-card">
      <div class="spinner"></div>
      <b>Memuatkan instrumen…</b>
      <span class="muted">Sekejap sahaja.</span>
    </div>`;
  }

  // SPEED: satu request sahaja untuk start submission + items + responses.
  const out=await post('open_assignment',{assignment_id:id},{loading:true,title:'Membuka Instrumen…',desc:'Sedang memuatkan borang dan item penjaminan kualiti.'});
  if(!out.ok){toast(out.message||out.error||'Gagal membuka instrumen.'); return}

  state.currentAssignment=out.assignment;
  state.currentSubmission=out.submission;
  state.currentMetadata=defaultMetadata(out.assignment.instrument_id,out.submission?.metadata||{});
  state.currentItems=out.items||[];
  const itemById=new Map(state.currentItems.map(i=>[i.item_id,i]));
  state.currentResponses={};
  (out.responses||[]).forEach(r=>{
    const item=itemById.get(r.item_id);
    const copy={...r};
    if(item?.jenis_respons==='SKALA_1_5' && !/^[1-5]$/.test(String(copy.jawapan||''))) copy.jawapan='';
    if(item?.jenis_respons==='YA_TIDAK' && !/^(YA|TIDAK)$/i.test(String(copy.jawapan||''))) copy.jawapan='';
    state.currentResponses[r.item_id]=copy;
  });

  renderForm(out.assignment,out.submission);
}

function renderForm(a,sub){
  title(a.instrument?.tajuk||a.instrument_id);
  const status=sub?.status||'OPEN';
  const locked=String(status).toUpperCase()==='SUBMITTED';
  let lastSection='';
  let lastBahagian='';
  const html=state.currentItems.map(item=>{
    const r=state.currentResponses[item.item_id]||{};
    let section='';
    const sec=`${item.bahagian} — ${item.seksyen}`;
    if(item.bahagian!==lastBahagian){
      lastBahagian=item.bahagian;
      section+=sectionInstructionHtml(item.bahagian);
    }
    if(sec!==lastSection){lastSection=sec;section+=`<div class="section-title"><h2>${esc(sec)}</h2></div>`}
    return section+renderItem(item,r,locked);
  }).join('');

  $('#view').innerHTML=`<div class="toolbar" style="margin-bottom:14px">
    <button class="btn btn-light" id="backAssign">← Kembali</button>
    <span class="badge ${locked?'ok':'gray'}">${esc(status)}</span>
    <span id="saveState" class="muted"></span>
    ${locked&&sub?.submission_id?`<button class="btn btn-light" id="downloadOwnPdf">Muat Turun PDF</button><button class="btn btn-light btn-update" id="reopenOwn">KEMASKINI</button><button class="btn btn-danger" id="deleteOwn">PADAM</button>`:''}
  </div>
  ${renderMetadataCard(a,locked)}
  <div class="card">${html}</div>
  ${locked?`<div class="card signature-summary" style="margin-top:16px">
      <b>Tandatangan Digital</b>
      <span class="muted">Tandatangan telah disimpan bersama hantaran.</span>
    </div>`:`<div class="card" style="margin-top:16px">
    <div class="form-row"><div><label>Nama Penandatangan</label><input id="signer" value="${esc(state.user.nama)}"></div></div>
    <div class="signature-block">
      <div class="signature-head">
        <div><label>Tandatangan Digital</label><div class="muted signature-hint">Gunakan tetikus atau jari untuk tandatangan dalam kotak.</div></div>
        <button type="button" class="btn btn-light" id="clearSignature">Padam Tandatangan</button>
      </div>
      <div class="signature-pad-wrap"><canvas id="signaturePad" aria-label="Pad tandatangan digital"></canvas></div>
    </div>
    <div class="toolbar" style="margin-top:14px"><button id="submitForm" class="btn btn-success">Hantar Instrumen</button></div>
  </div>`}`;

  $('#backAssign').onclick=()=>viewAssignments();
  if(locked&&sub?.submission_id){
    $('#downloadOwnPdf').onclick=()=>downloadSubmissionPdf(sub.submission_id);
    $('#reopenOwn').onclick=()=>reopenOwnSubmission(sub.submission_id,a.assignment_id);
    $('#deleteOwn').onclick=()=>requestDeleteSubmission(sub.submission_id,()=>viewAssignments());
  }
  if(!locked){
    $$('[data-item]').forEach(el=>{
      el.onchange=handleAnswerChange;
      if(el.tagName==='TEXTAREA') el.oninput=handleAnswerChange;
    });
    $$('[data-meta]').forEach(el=>{el.onchange=handleMetadataChange;el.oninput=handleMetadataChange});
    $$('[data-meta-scope]').forEach(el=>el.onchange=handleMetadataChange);
    initSignaturePad();
    $('#submitForm').onclick=submitCurrent;
  }
}

function initSignaturePad(){
  const canvas=$('#signaturePad');
  if(!canvas) return;
  const wrap=canvas.parentElement;
  const dpr=Math.max(1,window.devicePixelRatio||1);
  const rect=wrap.getBoundingClientRect();
  canvas.width=Math.max(300,Math.floor(rect.width*dpr));
  canvas.height=Math.floor(180*dpr);
  canvas.style.width='100%';
  canvas.style.height='180px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#111827'; ctx.lineWidth=2.4;
  state.signatureHasInk=false;
  let drawing=false;
  const point=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
  canvas.onpointerdown=e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);e.preventDefault()};
  canvas.onpointermove=e=>{if(!drawing)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();state.signatureHasInk=true;e.preventDefault()};
  const stop=e=>{drawing=false;try{canvas.releasePointerCapture(e.pointerId)}catch(_){}};
  canvas.onpointerup=stop; canvas.onpointercancel=stop; canvas.onpointerleave=e=>{if(drawing)stop(e)};
  $('#clearSignature').onclick=()=>{ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);state.signatureHasInk=false};
}

function getSignatureData(){
  const canvas=$('#signaturePad');
  if(!canvas||!state.signatureHasInk)return '';
  return canvas.toDataURL('image/png');
}

function renderItem(item,r,locked){
  const name=`q_${item.item_id}`;
  let control='';
  if(item.jenis_respons==='YA_TIDAK'){
    control=`<div class="yesno">
      ${['YA','TIDAK'].map(v=>`<label><input ${locked?'disabled':''} data-item="${esc(item.item_id)}" data-field="jawapan" type="radio" name="${esc(name)}" value="${v}" ${String(r.jawapan)===v?'checked':''}><span>${v}</span></label>`).join('')}
    </div>`;
  }else{
    control=`<div class="scale">
      ${[1,2,3,4,5].map(v=>`<label><input ${locked?'disabled':''} data-item="${esc(item.item_id)}" data-field="jawapan" type="radio" name="${esc(name)}" value="${v}" ${String(r.jawapan)===String(v)?'checked':''}><span>${v}</span></label>`).join('')}
    </div>`;
  }
  return `<div class="form-item">
    <div class="q">${esc(item.no_item)}. ${esc(item.pernyataan)}</div>
    <div class="meta">${esc(item.jenis_respons)}${(item.wajib===true||item.wajib==='TRUE')?' · wajib':''}</div>
    ${control}
    <div style="margin-top:10px"><textarea ${locked?'disabled':''} data-item="${esc(item.item_id)}" data-field="catatan" placeholder="Catatan (jika perlu)">${esc(r.catatan||'')}</textarea></div>
  </div>`;
}

function handleAnswerChange(e){
  const el=e.target, itemId=el.dataset.item, field=el.dataset.field;
  state.currentResponses[itemId]=state.currentResponses[itemId]||{item_id:itemId};
  state.currentResponses[itemId][field]=el.value;
  $('#saveState').textContent='Belum disimpan…';
  clearTimeout(state.saveTimer);
  state.saveTimer=setTimeout(saveCurrentResponses,700);
}

async function saveCurrentResponses(){
  const sub=state.currentSubmission;
  const responses=Object.values(state.currentResponses).map(r=>({
    item_id:r.item_id,jawapan:r.jawapan||'',catatan:r.catatan||'',evidence_url:r.evidence_url||''
  }));
  const payload={responses,assignment_id:state.currentAssignment.assignment_id};
  if(sub?.submission_id) payload.submission_id=sub.submission_id;
  const out=await post('save_responses',payload);
  if(out.ok && out.submission_id && !state.currentSubmission){
    state.currentSubmission={submission_id:out.submission_id,status:'DRAFT',metadata:state.currentMetadata};
  }
  $('#saveState').textContent=out.ok?'Disimpan':'Gagal simpan';
  return out;
}

async function submitCurrent(){
  const btn=$('#submitForm');
  if(btn){btn.disabled=true;btn.textContent='Menghantar…'}
  try{
    const meta=collectMetadataFromDom();
    const missingMeta=missingMetadataFields(state.currentAssignment.instrument_id,meta);
    if(missingMeta.length){
      toast(`Lengkapkan dahulu: ${missingMeta.map(x=>META_LABELS[x]||x).join(', ')}.`);
      return;
    }

    const invalidItems=state.currentItems.filter(item=>{
      const r=state.currentResponses[item.item_id]||{};
      const q={...item,jawapan:r.jawapan||''};
      return !validateAnswerValue(q);
    });
    if(invalidItems.length){
      toast(`Lengkapkan/pilih semula jawapan: ${invalidItems.slice(0,6).map(i=>`${i.bahagian} ${i.no_item}`).join(', ')}${invalidItems.length>6?'…':''}`);
      return;
    }

    await saveCurrentMetadata();
    await saveCurrentResponses();
    const signer=$('#signer').value.trim();
    if(!signer){toast('Isi nama penandatangan.');return}
    if(!state.signatureHasInk){toast('Sila tandatangan dalam kotak Tandatangan Digital.');return}
    if(!state.currentSubmission?.submission_id){toast('Lengkapkan maklumat dan jawab instrumen dahulu sebelum hantar.');return}

    const out=await post('submit_submission',{
      submission_id:state.currentSubmission.submission_id,
      nama_penandatangan:signer,
      signature_data:getSignatureData()
    },{
      loading:true,
      title:'Menghantar Instrumen…',
      desc:'Sedang menyimpan tandatangan dan memuktamadkan hantaran.',
      timeoutMs:45000
    });

    if(!out.ok){
      if(out.error==='INCOMPLETE') toast(`Masih ada ${out.missing_item_ids.length} item wajib belum dijawab.`);
      else if(out.error==='METADATA_INCOMPLETE') toast(`Maklumat Bahagian A belum lengkap: ${(out.missing_fields||[]).map(x=>META_LABELS[x]||x).join(', ')}.`);
      else toast(out.message||out.error);
      return;
    }

    state.currentSubmission={...state.currentSubmission,status:'SUBMITTED',metadata:state.currentMetadata};
    toast('Hantaran berjaya disimpan dalam Neon.');
    await refreshAssignments(true);
    await viewAssignments();
  }catch(err){
    console.error(err);
    const msg=err?.name==='AbortError'?'Proses mengambil masa terlalu lama. Data jawapan masih disimpan — cuba Hantar semula.':(err?.message||'Gagal menghantar instrumen.');
    toast(msg);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Hantar Instrumen'}
  }
}

async function viewStaff(){
  title('Pengurusan Guru');
  const out=await get('staff',{}, {loading:true,title:'Memuatkan Senarai Guru…',desc:'Sedang mendapatkan data guru.'});
  const rows=out.staff||[];
  $('#view').innerHTML=`<div class="section-title"><h2>Senarai Guru</h2><button class="btn btn-primary" id="addStaff">+ Tambah Guru</button></div>
  <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Jawatan</th><th>Panitia</th><th>Admin</th><th></th></tr></thead><tbody>
    ${rows.map(s=>`<tr><td>${esc(s.nama||s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.jawatan_hakiki)}</td><td>${esc(s.panitia)}</td><td>${s.is_admin?'Ya':'Tidak'}</td><td><button class="btn btn-light" data-edit="${esc(s.staff_id)}">Edit</button></td></tr>`).join('')}
  </tbody></table></div>`;
  $('#addStaff').onclick=()=>staffModal(null);
  $$('[data-edit]').forEach(b=>b.onclick=()=>staffModal(rows.find(x=>x.staff_id===b.dataset.edit)));
}

function staffModal(s){
  modal(`<h2>${s?'Edit':'Tambah'} Guru</h2>
    <form id="staffForm" class="stack">
      <div><label>Nama</label><input id="sNama" value="${esc(s?.nama||'')}" required></div>
      <div><label>Email</label><input id="sEmail" type="email" value="${esc(s?.email||'')}" required></div>
      <div class="form-row"><div><label>Jawatan</label><input id="sJawatan" value="${esc(s?.jawatan_hakiki||'')}"></div>
      <div><label>Panitia</label><input id="sPanitia" value="${esc(s?.panitia||'')}"></div></div>
      <div><label>No. Kad Pengenalan ${s?'(kosong = kekal)':''}</label><input id="sIc" inputmode="numeric" maxlength="12" placeholder="12 digit"></div>
      <div><label>PIN lama (opsyen kecemasan) ${s?'(kosong = kekal)':''}</label><input id="sPin" inputmode="numeric" pattern="\\d{4,8}"></div>
      <label><input id="sAdmin" type="checkbox" style="width:auto" ${s?.is_admin?'checked':''}> Pentadbir sistem</label>
      <div class="toolbar"><button class="btn btn-primary" type="submit">Simpan</button><button class="btn btn-light" type="button" data-close>Tutup</button></div>
    </form>`);
  $('[data-close]').onclick=closeModal;
  $('#staffForm').onsubmit=async e=>{
    e.preventDefault();
    const payload={
      staff_id:s?.staff_id,nama:$('#sNama').value,email:$('#sEmail').value,
      jawatan_hakiki:$('#sJawatan').value,panitia:$('#sPanitia').value,
      is_admin:$('#sAdmin').checked
    };
    if($('#sIc') && $('#sIc').value.trim()) payload.ic=$('#sIc').value.trim();
    if($('#sPin') && $('#sPin').value.trim()) payload.pin=$('#sPin').value.trim();
    const out=await post('upsert_staff',payload,{loading:true,title:'Menyimpan Guru…',desc:'Sedang mengemaskini rekod guru.'});
    if(!out.ok){toast(out.message||out.error);return}
    closeModal(); toast('Guru disimpan.'); viewStaff();
  };
}

async function viewBundles(){
  title('Tetapan Bundle Peranan');
  $('#view').innerHTML=`<div class="card loading-card"><div class="spinner"></div><b>Memuatkan bundle…</b></div>`;
  const out=await get('bundles',{}, {loading:true,title:'Memuatkan Bundle Peranan…',desc:'Sedang mendapatkan tetapan bundle.'});
  if(!out.ok){toast(out.message||out.error||'Gagal memuat bundle.');return}
  state.bundleAdmin={bundles:out.bundles||[],staff:out.staff||[],instruments:out.instruments||[]};
  const first=state.bundleAdmin.bundles.find(b=>b.bundle_id==='BUNDLE-KETUA-PANITIA')||state.bundleAdmin.bundles[0]||null;
  renderBundleAdmin(first?.bundle_id||'NEW');
}

function renderBundleAdmin(selectedId){
  const data=state.bundleAdmin;if(!data)return;
  const {bundles,staff,instruments}=data;
  const isNew=selectedId==='NEW';
  const bundle=isNew?{bundle_id:'',nama_bundle:'',keterangan:'',aktif:true,carry_forward:true,member_ids:[],instrument_ids:[]}:(bundles.find(b=>b.bundle_id===selectedId)||bundles[0]);
  const selectedMembers=new Set(bundle.member_ids||[]), selectedInstruments=new Set(bundle.instrument_ids||[]);
  $('#view').innerHTML=`
  <div class="bundle-layout">
    <div class="card bundle-side">
      <div class="section-title" style="margin-top:0"><h2>Bundle</h2><button class="btn btn-primary" id="newBundle">+ Baru</button></div>
      <div class="bundle-list">${bundles.map(b=>`<button class="bundle-choice ${b.bundle_id===bundle.bundle_id?'active':''}" data-bundle="${esc(b.bundle_id)}"><b>${esc(b.nama_bundle)}</b><small>${(b.member_ids||[]).length} guru · ${(b.instrument_ids||[]).length} instrumen</small></button>`).join('')}</div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="section-title" style="margin-top:0"><h2>${isNew?'Bundle Baharu':esc(bundle.nama_bundle)}</h2>${!isNew&&bundle.bundle_id!=='BUNDLE-ALL-GURU'?`<button class="btn btn-danger" id="deactivateBundle">Nyahaktif</button>`:''}</div>
        <div class="form-row"><div><label>Nama Bundle</label><input id="bundleName" value="${esc(bundle.nama_bundle||'')}" placeholder="Contoh: KETUA PANITIA"></div><div><label>Keterangan</label><input id="bundleDesc" value="${esc(bundle.keterangan||'')}" placeholder="Keterangan ringkas"></div></div>
        <div class="toolbar" style="margin-top:12px"><label class="inline-check"><input id="bundleActive" type="checkbox" ${bundle.aktif!==false?'checked':''}> Aktif</label><label class="inline-check"><input id="bundleCarry" type="checkbox" ${bundle.carry_forward!==false?'checked':''}> Bawa ke tahun baharu</label></div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-top:0"><h2>Instrumen Dalam Bundle</h2><span class="muted">Tick instrumen untuk peranan ini</span></div>
        <div class="instrument-grid">${instruments.map(i=>`<label class="check-card"><input type="checkbox" class="bundle-inst" value="${esc(i.instrument_id)}" ${selectedInstruments.has(i.instrument_id)?'checked':''}><span><b>${esc(i.modul)} · Lampiran ${esc(i.lampiran)}</b><small>${esc(i.sasaran_role||'')}</small></span></label>`).join('')}</div>
      </div>
      <div class="card">
        <div class="section-title" style="margin-top:0"><h2>Pilih Guru</h2><span id="memberCount" class="badge">${selectedMembers.size} dipilih</span></div>
        <div class="toolbar"><input id="teacherSearch" placeholder="Cari nama guru…" style="max-width:320px"><button class="btn btn-light" id="selectAllVisible">Pilih Semua</button><button class="btn btn-light" id="clearAll">Kosongkan Semua</button></div>
        <div class="teacher-check-list" id="teacherList">${staff.map(s=>`<label class="teacher-check" data-name="${esc(String(s.nama).toLowerCase())}"><input type="checkbox" class="bundle-member" value="${esc(s.staff_id)}" ${selectedMembers.has(s.staff_id)?'checked':''}><span><b>${esc(s.nama||s.name)}</b><small>${esc(s.jawatan_hakiki||'')}</small></span></label>`).join('')}</div>
      </div>
      <div class="bundle-savebar"><button class="btn btn-primary" id="saveBundle">Simpan Bundle</button><span class="muted">Simpan terus selaraskan tugasan tahun aktif.</span></div>
    </div>
  </div>`;

  $('#newBundle').onclick=()=>renderBundleAdmin('NEW');
  $$('[data-bundle]').forEach(b=>b.onclick=()=>renderBundleAdmin(b.dataset.bundle));
  const updateCount=()=>{$('#memberCount').textContent=`${$$('.bundle-member:checked').length} dipilih`};
  $$('.bundle-member').forEach(c=>c.onchange=updateCount);
  $('#teacherSearch').oninput=e=>{const q=e.target.value.trim().toLowerCase();$$('.teacher-check').forEach(row=>row.classList.toggle('hidden',q&&!row.dataset.name.includes(q)))};
  $('#selectAllVisible').onclick=()=>{$$('.teacher-check:not(.hidden) .bundle-member').forEach(c=>c.checked=true);updateCount()};
  $('#clearAll').onclick=()=>{$$('.bundle-member').forEach(c=>c.checked=false);updateCount()};
  $('#saveBundle').onclick=async()=>{
    const name=$('#bundleName').value.trim();if(!name){toast('Masukkan nama bundle.');return}
    const btn=$('#saveBundle');btn.disabled=true;btn.textContent='Menyimpan…';
    const payload={bundle_id:bundle.bundle_id||'',nama_bundle:name,keterangan:$('#bundleDesc').value.trim(),aktif:$('#bundleActive').checked,carry_forward:$('#bundleCarry').checked,member_ids:$$('.bundle-member:checked').map(x=>x.value),instrument_ids:$$('.bundle-inst:checked').map(x=>x.value)};
    const saved=await post('save_bundle',payload,{loading:true,title:'Menyimpan Bundle…',desc:'Sedang menyelaras ahli dan instrumen.'});btn.disabled=false;btn.textContent='Simpan Bundle';
    if(!saved.ok){toast(saved.message||saved.error||'Gagal simpan bundle.');return}
    toast(`Bundle disimpan. ${saved.assignments_created||0} tugasan baharu.`);await viewBundles();
  };
  if($('#deactivateBundle')) $('#deactivateBundle').onclick=async()=>{if(!confirm(`Nyahaktif bundle "${bundle.nama_bundle}"?`))return;const r=await post('deactivate_bundle',{bundle_id:bundle.bundle_id},{loading:true,title:'Menyahaktif Bundle…',desc:'Sedang mengemaskini tetapan bundle.'});if(!r.ok){toast(r.message||r.error);return}toast('Bundle dinyahaktif.');await viewBundles()};
}

async function viewAdminAssignments(){
  title('Tugasan Instrumen');
  if(!state.boot) await loadBoot();
  const [staffOut,asgnOut]=await Promise.all([get('staff'),get('admin_assignments',{}, {loading:true,title:'Memuatkan Tugasan…',desc:'Sedang mendapatkan semua tugasan sesi aktif.'})]);
  const staff=staffOut.staff||[];
  const rows=asgnOut.assignments||[];
  const inst=state.boot.instruments||[];
  const cycles=state.boot.cycles||[];

  $('#view').innerHTML=`<div class="card">
    <h2 style="margin-top:0">Cipta Tugasan Manual</h2>
    <div class="form-row">
      <div><label>Guru</label><select id="aStaff">${staff.map(s=>`<option value="${esc(s.staff_id)}">${esc(s.nama||s.name)}</option>`).join('')}</select></div>
      <div><label>Instrumen</label><select id="aInst">${inst.map(i=>`<option value="${esc(i.instrument_id)}">${esc(i.tajuk)}</option>`).join('')}</select></div>
      <div><label>Kitaran</label><select id="aCycle">${cycles.map(c=>`<option value="${esc(c.cycle_id)}">${esc(c.nama_kitaran||c.name||c.cycle_id)}</option>`).join('')}</select></div>
      <div><label>Tarikh akhir</label><input id="aDate" type="date"></div>
    </div>
    <div class="toolbar" style="margin-top:14px"><button id="createAsn" class="btn btn-primary">Cipta Tugasan</button></div>
  </div>
  <div class="section-title"><h2>Semua Tugasan (${rows.length})</h2></div>
  <div class="table-wrap"><table><thead><tr><th>Guru</th><th>Instrumen</th><th>Status Tugasan</th><th>Status Hantaran</th><th>Tarikh Hantar</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.staff_name)}</td><td>${esc(r.instrument_title||r.instrument_id)}</td><td>${esc(r.status)}</td><td><span class="badge ${r.submission_status==='SUBMITTED'?'ok':r.submission_status==='DRAFT'?'warn':'gray'}">${esc(r.submission_status||'BELUM ISI')}</span></td><td>${formatDateTime(r.submitted_at)}</td></tr>`).join('')}
  </tbody></table></div>`;
  $('#createAsn').onclick=async()=>{
    const out=await post('create_assignment',{staff_id:$('#aStaff').value,instrument_id:$('#aInst').value,cycle_id:$('#aCycle').value,tarikh_akhir:$('#aDate').value},{loading:true,title:'Mencipta Tugasan…',desc:'Sedang menyimpan tugasan baharu.'});
    toast(out.ok?(out.created?'Tugasan dicipta.':'Tugasan sudah wujud.'):(out.message||out.error));
    if(out.ok) await viewAdminAssignments();
  };
}

async function viewSubmissions(){
  title('Hantaran');
  const out=await get('submissions',{}, {loading:true,title:'Memuatkan Hantaran…',desc:'Sedang mendapatkan rekod hantaran.'});
  const all=out.submissions||[];
  const filter=state.submissionFilter||'ALL';
  const rows=filter==='ALL'?all:all.filter(r=>String(r.status).toUpperCase()===filter);
  $('#view').innerHTML=`<div class="toolbar filterbar">
    <button class="btn ${filter==='ALL'?'btn-primary':'btn-light'}" data-sub-filter="ALL">Semua (${all.length})</button>
    <button class="btn ${filter==='SUBMITTED'?'btn-primary':'btn-light'}" data-sub-filter="SUBMITTED">Selesai (${all.filter(r=>r.status==='SUBMITTED').length})</button>
    <button class="btn ${filter==='DRAFT'?'btn-primary':'btn-light'}" data-sub-filter="DRAFT">Draf (${all.filter(r=>r.status==='DRAFT').length})</button>
  </div>
  <div class="table-wrap"><table><thead><tr><th>Guru</th><th>Instrumen</th><th>Status</th><th>Tarikh Hantar</th><th>PDF</th><th>Tindakan</th></tr></thead><tbody>
  ${rows.map(r=>{
    const own=String(r.staff_id)===String(state.user.staff_id);
    return `<tr><td>${esc(r.staff_name)}</td><td>${esc(r.instrument_title||r.instrument_id)}</td><td><span class="badge ${r.status==='SUBMITTED'?'ok':'warn'}">${esc(r.status)}</span></td><td>${formatDateTime(r.tarikh_hantar)}</td><td>${r.status==='SUBMITTED'?`<button class="btn btn-light" data-pdf="${esc(r.submission_id)}">Muat Turun PDF</button>`:'-'}</td><td><div class="toolbar">${own&&r.status==='SUBMITTED'?`<button class="btn btn-light btn-update" data-reopen="${esc(r.submission_id)}" data-assignment="${esc(r.assignment_id)}">KEMASKINI</button>`:''}<button class="btn btn-danger" data-delete-sub="${esc(r.submission_id)}">PADAM</button></div></td></tr>`;
  }).join('')}
  </tbody></table></div>`;
  $$('[data-sub-filter]').forEach(b=>b.onclick=()=>{state.submissionFilter=b.dataset.subFilter;viewSubmissions()});
  $$('[data-pdf]').forEach(b=>b.onclick=()=>downloadSubmissionPdf(b.dataset.pdf));
  $$('[data-reopen]').forEach(b=>b.onclick=()=>reopenOwnSubmission(b.dataset.reopen,b.dataset.assignment));
  $$('[data-delete-sub]').forEach(b=>b.onclick=()=>requestDeleteSubmission(b.dataset.deleteSub,()=>viewSubmissions()));
}

async function viewFollowups(){
  title('Tindakan Susulan');
  const out=await get('followups',{}, {loading:true,title:'Memuatkan Tindakan Susulan…',desc:'Sedang mendapatkan tindakan susulan terbuka.'});
  const rows=out.followups||[];
  $('#view').innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Guru</th><th>Instrumen</th><th>Dapatan</th><th>Tindakan</th><th>Pegawai</th><th>Tarikh Sasaran</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.staff_name)}</td><td>${esc(r.instrument_title||r.instrument_id)}</td><td>${esc(r.finding||'-')}</td><td>${esc(r.action_text||'-')}</td><td>${esc(r.responsible_officer||'-')}</td><td>${esc(r.target_date||'-')}</td><td><span class="badge warn">${esc(r.status)}</span></td></tr>`).join('')}</tbody></table></div>`:`<div class="card muted">Tiada tindakan susulan terbuka.</div>`;
}


function formatDateTime(v){
  if(!v) return '-';
  try{return new Intl.DateTimeFormat('ms-MY',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch(_){return String(v)}
}

async function reopenOwnSubmission(submissionId,assignmentId){
  if(!confirm('Kemaskini hantaran ini? Status akan dibuka semula sebagai DRAF dan anda perlu tandatangan serta hantar semula.')) return;
  const out=await post('reopen_submission',{submission_id:submissionId},{loading:true,title:'Membuka Semula Instrumen…',desc:'Sedang menyediakan borang untuk dikemaskini.'});
  if(!out.ok){toast(out.message||out.error||'Gagal membuka semula instrumen.');return}
  toast('Instrumen dibuka semula untuk kemaskini.');
  await refreshAssignments(true);
  const a=state.assignments.find(x=>x.assignment_id===assignmentId);
  if(a) openAssignment(assignmentId,state.assignments); else viewAssignments();
}

function requestDeleteSubmission(submissionId,onDone){
  if(!confirm('Adakah anda pasti mahu PADAM hantaran ini? Jawapan yang dipadam tidak boleh dikembalikan melalui webapp.')) return;
  modal(`<h2>Pengesahan Padam</h2>
    <p>Masukkan <b>No. Kad Pengenalan anda sendiri</b> untuk mengesahkan padam.</p>
    <p class="muted">Pemilik instrumen menggunakan IC sendiri. Jika anda Admin, masukkan IC Admin yang sedang log masuk. Hanya salah satu pihak diperlukan.</p>
    <div><label>No. Kad Pengenalan Pengesah</label><input id="deleteVerifyIc" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="12 digit"></div>
    <div class="toolbar" style="margin-top:16px"><button class="btn btn-danger" id="confirmDeleteSub">YA, PADAM</button><button class="btn btn-light" id="cancelDeleteSub">BATAL</button></div>`);
  const ic=$('#deleteVerifyIc');
  ic.oninput=()=>ic.value=ic.value.replace(/\D/g,'').slice(0,12);
  $('#cancelDeleteSub').onclick=closeModal;
  $('#confirmDeleteSub').onclick=async()=>{
    if(ic.value.length!==12){toast('Masukkan 12 digit No. Kad Pengenalan.');return}
    const out=await post('delete_submission',{submission_id:submissionId,ic:ic.value},{loading:true,title:'Memadam Hantaran…',desc:'Sedang mengesahkan identiti dan memadam data.'});
    if(!out.ok){toast(out.message||out.error||'Pengesahan gagal.');return}
    closeModal();
    toast('Hantaran berjaya dipadam.');
    await refreshAssignments(true).catch(()=>{});
    if(onDone) await onDone();
  };
}

async function submissionDetail(submissionId){
  const out=await get('submission_detail',{submission_id:submissionId});
  if(!out.ok) throw new Error(out.message||out.error||'Gagal mendapatkan data PDF.');
  return out;
}


const KPM_TEMPLATE_MARKERS = {
  'PBD-A': {
    headings: ['INSTRUMEN PENJAMINAN MUTU PBD_SLT'],
    lampiran: 'LAMPIRAN A'
  },
  'PBD-B': {
    headings: ['INSTRUMEN PENJAMINAN MUTU PBD_ML'],
    lampiran: 'LAMPIRAN B'
  },
  'PBD-C': {
    headings: ['INSTRUMEN PENJAMINAN MUTU PBD_GMP'],
    lampiran: 'LAMPIRAN C'
  },
  'PPSI-A': {
    headings: ['SENARAI SEMAK PENJAMINAN MUTU PPSI_PGB', 'SENARAI SEMAK PENJAMINAN MUTU PPSI PGB'],
    lampiran: 'LAMPIRAN A'
  },
  'PPSI-B': {
    headings: ['SENARAI SEMAK PENJAMINAN MUTU PPSI_GPK HEM', 'SENARAI SEMAK PENJAMINAN MUTU PPSI GPK HEM'],
    lampiran: 'LAMPIRAN B'
  },
  'PPSI-C': {
    headings: ['INSTRUMEN PENJAMINAN MUTU PPSI_GBK', 'INSTRUMEN PENJAMINAN MUTU PPSI GBK'],
    lampiran: 'LAMPIRAN C'
  },
  'PAJSK-A': {
    headings: ['INSTRUMEN PENJAMINAN MUTU PAJSK_SLT'],
    lampiran: 'LAMPIRAN A'
  },
  'PAJSK-B': {
    headings: ['INSTRUMEN PENJAMINAN MUTU PAJSK_GURU KOKURIKULUM', 'INSTRUMEN PENJAMINAN MUTU PAJSK GURU KOKURIKULUM'],
    lampiran: 'LAMPIRAN B'
  },
  'SEGAK-A': {
    headings: ['INSTRUMEN PENJAMINAN MUTU SEGAK& BMI5-9T_SLT', 'INSTRUMEN PENJAMINAN MUTU SEGAK & BMI 5-9T SLT'],
    lampiran: 'LAMPIRAN A'
  },
  'SEGAK-B': {
    headings: ['INSTRUMEN PENJAMINAN MUTU SEGAK & BMI 5-9T_ML', 'INSTRUMEN PENJAMINAN MUTU SEGAK & BMI 5-9T ML'],
    lampiran: 'LAMPIRAN B'
  },
  'SEGAK-C': {
    headings: ['INSTRUMEN PENJAMINAN MUTU SEGAK & BMI5-9T_GMP/GPRA', 'INSTRUMEN PENJAMINAN MUTU SEGAK & BMI 5-9T GMP/GPRA'],
    lampiran: 'LAMPIRAN C'
  }
};

let kpmPdfLibPromise=null;
let kpmPdfJsPromise=null;
let kpmSourcePromise=null;

function normPdfText(v){
  return String(v||'')
    .normalize('NFKC')
    .replace(/\s+/g,' ')
    .trim()
    .toUpperCase();
}

function compactPdfText(v){
  return normPdfText(v).replace(/[^A-Z0-9]/g,'');
}

function templateStartMatches(text, template){
  const compact=compactPdfText(text);
  const hasHeading=(template.headings||[]).some(h=>compact.includes(compactPdfText(h)));
  const hasLampiran=compact.includes(compactPdfText(template.lampiran||''));
  // Every instrument starts with Bahagian A. This prevents matching continuation pages.
  const hasBahagianA=compact.includes(compactPdfText('BAHAGIAN A'));
  return hasHeading && hasLampiran && hasBahagianA;
}

async function loadPdfLib(){
  if(!kpmPdfLibPromise) kpmPdfLibPromise=import('https://esm.sh/pdf-lib@1.17.1');
  return kpmPdfLibPromise;
}

async function loadPdfJs(){
  if(!kpmPdfJsPromise){
    kpmPdfJsPromise=import('https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs').then(m=>{
      m.GlobalWorkerOptions.workerSrc='https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs';
      return m;
    });
  }
  return kpmPdfJsPromise;
}

async function loadOfficialKpmPdf(){
  if(!kpmSourcePromise){
    // Guna salinan PDF rasmi KPM yang telah diaudit dan dibundel bersama webapp.
    // Ini mengelakkan perubahan URL/versi luar daripada merosakkan mapping.
    kpmSourcePromise=fetch('/assets/kpm-pbs-official.pdf',{cache:'force-cache'}).then(async r=>{
      if(!r.ok) throw new Error(`Template rasmi KPM gagal dimuatkan (${r.status}).`);
      const raw=await r.arrayBuffer();
      return new Uint8Array(raw);
    });
  }
  const cached=await kpmSourcePromise;
  return cached.slice().buffer;
}

async function extractKpmPages(sourceBytes, instrumentId){
  const pdfjs=await loadPdfJs();
  const targetTemplate=KPM_TEMPLATE_MARKERS[instrumentId];
  if(!targetTemplate) throw new Error(`Template rasmi ${instrumentId} belum dipetakan.`);

  // PDF.js boleh mengambil alih (detach) ArrayBuffer yang diterima.
  // Gunakan salinan khas untuk parser PDF.js supaya buffer lain kekal selamat.
  const pdfJsBytes=new Uint8Array(sourceBytes.slice(0));
  const loading=pdfjs.getDocument({data:pdfJsBytes});
  const doc=await loading.promise;
  const pages=[];
  const starts={};

  // Scan the official KPM PDF once and discover the START page of all 11 instruments.
  // Do not depend on "-TAMAT-" because PDF text extraction may split the word/punctuation.
  for(let p=1;p<=doc.numPages;p++){
    const page=await doc.getPage(p);
    const tc=await page.getTextContent();
    const text=normPdfText(tc.items.map(x=>x.str).join(' '));
    pages.push({pageNo:p,page,text,items:tc.items});

    for(const [id,tpl] of Object.entries(KPM_TEMPLATE_MARKERS)){
      if(!starts[id] && templateStartMatches(text,tpl)) starts[id]=p;
    }
  }

  const startPage=starts[instrumentId]||0;
  if(!startPage){
    const found=Object.entries(starts).sort((a,b)=>a[1]-b[1]).map(([id,p])=>`${id}:${p}`).join(', ');
    throw new Error(`Halaman rasmi KPM untuk ${instrumentId} tidak dijumpai. Dikesan: ${found||'tiada'}.`);
  }

  // The current form ends immediately before the next instrument starts.
  // For the last instrument, use the final page of the official KPM PDF.
  const nextStarts=Object.values(starts).filter(p=>p>startPage).sort((a,b)=>a-b);
  const endPage=nextStarts.length ? nextStarts[0]-1 : doc.numPages;

  if(endPage<startPage) throw new Error(`Julat halaman rasmi ${instrumentId} tidak sah.`);

  return {
    startPage,endPage,
    pages:pages.filter(x=>x.pageNo>=startPage && x.pageNo<=endPage),
    pdfjsDoc:doc,
    detectedStarts:starts
  };
}

function textCandidates(pageInfo, exactText){
  const target=normPdfText(exactText);
  return pageInfo.items
    .map((it,idx)=>({it,idx,s:normPdfText(it.str),x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,h:Math.abs(it.transform?.[3]||10)}))
    .filter(x=>x.s===target);
}

function sectionAwareItemAnchors(pageInfos, items){
  const cPageIndex=pageInfos.findIndex(p=>compactPdfText(p.text).includes(compactPdfText('BAHAGIAN C')));
  const mappedPages=pageInfos.map((p,pi)=>({
    pi,
    entries:p.items.map((it,idx)=>({it,idx,s:normPdfText(it.str),x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,h:Math.abs(it.transform?.[3]||10)}))
  }));
  const anchors=new Map();

  for(const q of items){
    const section=String(q.bahagian||'').toUpperCase();
    let pages=mappedPages;
    if(cPageIndex>=0){
      if(section==='B') pages=mappedPages.filter(p=>p.pi<cPageIndex);
      else if(section==='C') pages=mappedPages.filter(p=>p.pi>=cPageIndex);
    }

    const no=normPdfText(q.no_item);
    let candidates=[];
    for(const p of pages){
      for(const e of p.entries){
        if(e.s===no) candidates.push({...e,pi:p.pi});
      }
    }

    // If exact item number extraction fails, fall back to the first distinctive statement words.
    if(!candidates.length){
      const words=normPdfText(q.pernyataan).split(/\s+/).filter(w=>w.length>=6).slice(0,4);
      for(const p of pages){
        for(const e of p.entries){
          const score=words.reduce((n,w)=>n+(e.s.includes(w)?1:0),0);
          if(score>=2) candidates.push({...e,pi:p.pi,wordScore:score});
        }
      }
      candidates.sort((a,b)=>(b.wordScore||0)-(a.wordScore||0));
    }

    if(candidates.length) anchors.set(q.item_id,candidates[0]);
  }
  return anchors;
}


const KPM_SOURCE_REPAIRS = Object.freeze({
  // PDF rasmi KPM: PBD-B Bahagian C item 4.1 tercetak "1 2 3 4 4".
  // Sistem betulkan sel terakhir kepada 5 sebelum membulatkan jawapan.
  'PBD-B:C:4.1': {rewriteScaleLabels:true},

  // PDF rasmi KPM: SEGAK-C Bahagian C item 3.1-3.3 mempunyai LIMA petak skala
  // tetapi angka 1-5 tidak dicetak. Arahan Bahagian C tetap mengarahkan skala 1-5.
  'SEGAK-C:C:3.1': {injectScaleLabels:true},
  'SEGAK-C:C:3.2': {injectScaleLabels:true},
  'SEGAK-C:C:3.3': {injectScaleLabels:true}
});

function kpmItemKey(instrumentId,item){
  return `${instrumentId}:${String(item.bahagian||'').toUpperCase()}:${String(item.no_item||'')}`;
}

function specialSubitemAnchor(pageInfos,instrumentId,item){
  if(instrumentId!=='SEGAK-B') return null;
  const no=String(item.no_item||'');
  const needle=no==='2.3(i)'?'INDIVIDU':no==='2.3(ii)'?'KUMPULAN':'';
  if(!needle) return null;

  for(let pi=0;pi<pageInfos.length;pi++){
    for(const it of pageInfos[pi].items){
      const s=normPdfText(it.str);
      if(s.includes(needle)){
        return {
          pi,it,
          s,
          x:it.transform?.[4]||0,
          y:it.transform?.[5]||0,
          w:it.width||0,
          h:Math.abs(it.transform?.[3]||10)
        };
      }
    }
  }
  return null;
}

function validateAnswerValue(item){
  const a=String(item.jawapan||'').trim().toUpperCase();
  if(item.jenis_respons==='YA_TIDAK') return a==='YA'||a==='TIDAK';
  if(item.jenis_respons==='SKALA_1_5') return /^[1-5]$/.test(a);
  return !!a;
}

function answerTextFor(item){
  const a=String(item.jawapan||'').trim();
  if(!a) return '';
  if(item.jenis_respons==='YA_TIDAK') return /^TIDAK$/i.test(a)?'TIDAK':'YA';
  return a;
}

function findAnswerTarget(pageInfo, anchor, item){
  const wanted=normPdfText(answerTextFor(item));
  if(!wanted) return null;

  const candidates=[];
  for(const [idx,it] of pageInfo.items.entries()){
    const x=it.transform?.[4]||0;
    const y=it.transform?.[5]||0;
    const w=it.width||0;
    const h=Math.abs(it.transform?.[3]||10);
    // Answer columns are well to the right of the item number/text. Use a broad Y range,
    // then choose the nearest row. This handles tall/wrapped KPM table rows reliably.
    if(Math.abs(y-anchor.y)>75 || x<=anchor.x+150) continue;

    const raw=normPdfText(it.str);
    if(raw===wanted){
      candidates.push({it,idx,s:raw,x,y,w,h,score:0});
      continue;
    }

    const tokens=raw.split(/\s+/).map(t=>t.replace(/[^A-Z0-9]/g,'')).filter(Boolean);
    const wantedToken=wanted.replace(/[^A-Z0-9]/g,'');
    const ti=tokens.indexOf(wantedToken);
    if(ti>=0 && tokens.length>=2){
      const cellW=(w||Math.max(30,tokens.length*12))/tokens.length;
      candidates.push({it,idx,s:raw,x:x+ti*cellW,y,w:cellW,h,score:2});
    }
  }

  if(!candidates.length) return null;
  candidates.sort((a,b)=>Math.abs(a.y-anchor.y)-Math.abs(b.y-anchor.y) || a.score-b.score);
  return candidates[0];
}


function detectScaleGroups(pageInfo){
  const rows=[];

  function addPoint(y,value,cx){
    let row=rows.find(r=>Math.abs(r.y-y)<=2.8);
    if(!row){
      row={y,points:[]};
      rows.push(row);
    }
    row.points.push({value:String(value),cx});
  }

  for(const it of pageInfo.items){
    const raw=normPdfText(it.str);
    if(!raw) continue;

    const x=it.transform?.[4]||0;
    const y=it.transform?.[5]||0;
    const w=it.width||0;
    const tokens=raw.split(/\s+/).map(t=>t.replace(/[^0-9]/g,'')).filter(Boolean);

    // PDF item is a single digit.
    if(tokens.length===1 && ['1','2','3','4','5'].includes(tokens[0]) && raw.length<=3){
      addPoint(y,tokens[0],x+(w||6)/2);
      continue;
    }

    // Some PDF pages expose "1 2 3 4 5" as one text item.
    const valid=tokens.filter(t=>['1','2','3','4','5'].includes(t));
    if(valid.length>=4){
      const cellW=(w||valid.length*28)/valid.length;
      valid.forEach((t,i)=>addPoint(y,t,x+(i+0.5)*cellW));
    }
  }

  return rows.map(r=>{
    const byValue=new Map();
    for(const p of r.points){
      if(!byValue.has(p.value)) byValue.set(p.value,p.cx);
    }
    const values=['1','2','3','4','5'];
    const centers=values.map(v=>byValue.get(v)).filter(v=>Number.isFinite(v));
    return {y:r.y,byValue,centers};
  }).filter(r=>r.centers.length>=4);
}

function nearestScaleCenters(pageInfos,pageIndex,rowY){
  // First prefer a numeric scale row on the SAME page nearest to the Ya/Tidak row.
  const same=detectScaleGroups(pageInfos[pageIndex]||{items:[]});
  if(same.length){
    same.sort((a,b)=>Math.abs(a.y-rowY)-Math.abs(b.y-rowY));
    const m=same[0].byValue;
    const vals=['1','2','3','4','5'].map(v=>m.get(v));
    if(vals.every(Number.isFinite)) return vals;
  }

  // If this page only has Ya/Tidak rows, borrow the 5-column geometry
  // from the nearest page of the SAME official instrument.
  const candidates=[];
  pageInfos.forEach((p,pi)=>{
    for(const g of detectScaleGroups(p)){
      const vals=['1','2','3','4','5'].map(v=>g.byValue.get(v));
      if(vals.every(Number.isFinite)) candidates.push({distance:Math.abs(pi-pageIndex),centers:vals});
    }
  });
  candidates.sort((a,b)=>a.distance-b.distance);
  return candidates[0]?.centers||null;
}

function yaTidakCheckboxPoint(pageInfos,pageIndex,anchor,target,item){
  const centers=nearestScaleCenters(pageInfos,pageIndex,target?.y??anchor.y);
  const answer=String(item.jawapan||'').trim().toUpperCase();

  if(centers && centers.length===5){
    // Struktur rasmi KPM bagi baris Ya/Tidak menggunakan lima petak SKALA:
    // [ Ya ] [ PETAK TANDA ] [ Tidak ] [ gabungan/ruang ] [ PETAK TANDA ]
    // Berdasarkan grid rasmi, tanda Ya berada pada pusat kolum skala ke-2,
    // manakala tanda Tidak berada pada pusat kolum skala ke-5.
    return {
      x: answer==='TIDAK' ? centers[4] : centers[1],
      y:(target?.y??anchor.y)+Math.max(target?.h||8,8)*0.35,
      source:'scale-grid'
    };
  }

  // Fallback defensif: cari label Ya/Tidak pada baris yang sama.
  const rowY=target?.y??anchor.y;
  const entries=pageInfos[pageIndex].items.map(it=>({
    s:normPdfText(it.str),
    x:it.transform?.[4]||0,
    y:it.transform?.[5]||0,
    w:it.width||0,
    h:Math.abs(it.transform?.[3]||10)
  })).filter(e=>Math.abs(e.y-rowY)<=5);

  const ya=entries.find(e=>e.s==='YA');
  const tidak=entries.find(e=>e.s==='TIDAK');

  if(ya && tidak){
    const yaBlank=(ya.x+ya.w+tidak.x)/2;
    const baseWidth=Math.max(24,tidak.x-ya.x);
    const tidakBlank=tidak.x+tidak.w+Math.max(10,(baseWidth-tidak.w)/2);
    return {
      x:answer==='TIDAK'?tidakBlank:yaBlank,
      y:rowY+Math.max(target?.h||8,8)*0.35,
      source:'text-fallback'
    };
  }

  return {
    x:Math.max(5,(target?.x??anchor.x)+((target?.w||10)+18)),
    y:rowY+Math.max(target?.h||8,8)*0.35,
    source:'last-fallback'
  };
}

function drawVectorCheck(page,x,y,size=7,color){
  page.drawLine({start:{x:x-size*0.55,y:y},end:{x:x-size*0.12,y:y-size*0.42},thickness:1.6,color});
  page.drawLine({start:{x:x-size*0.12,y:y-size*0.42},end:{x:x+size*0.65,y:y+size*0.48},thickness:1.6,color});
}


const SEGAK_HEADER_BOXES = Object.freeze({
  'SEGAK-A': {
    roles: {
      'PENGETUA': {x:177.54,y:219.52},
      'GURU BESAR': {x:285.54,y:219.52},
      'GURU PENOLONG KANAN PENTADBIRAN': {x:390.54,y:219.72}
    },
    scope: {
      'SEGAK_SM': {x:744.94,y:511.36},
      'SEGAK_SR': {x:744.94,y:497.08},
      'BMI_SR': {x:744.94,y:482.80},
      'BMI_PRASEKOLAH': {x:744.94,y:468.52},
      'BMI_PPKI': {x:744.94,y:454.24}
    }
  },
  'SEGAK-B': {
    roles: {
      'GURU KANAN MATA PELAJARAN': {x:177.54,y:218.60},
      'KETUA PANITIA': {x:390.54,y:218.92}
    },
    scope: {
      'SEGAK_SM': {x:744.94,y:514.36},
      'SEGAK_SR': {x:744.94,y:500.08},
      'BMI_SR': {x:744.94,y:485.80},
      'BMI_PRASEKOLAH': {x:744.94,y:471.52},
      'BMI_PPKI': {x:744.94,y:457.24}
    }
  },
  'SEGAK-C': {
    roles: {
      'GMP PJPK': {x:177.54,y:220.56},
      'GURU PRASEKOLAH': {x:350.58,y:220.86},
      'GURU PPKI': {x:509.04,y:220.08}
    },
    scope: {
      'SEGAK_SM': {x:744.94,y:514.36},
      'SEGAK_SR': {x:744.94,y:500.08},
      'BMI_SR': {x:744.94,y:485.80},
      'BMI_PRASEKOLAH': {x:744.94,y:471.52},
      'BMI_PPKI': {x:744.94,y:457.24}
    }
  }
});

function stampSegakHeaderCheckboxes(outPage,instrumentId,meta,color){
  const map=SEGAK_HEADER_BOXES[instrumentId];
  if(!map) return {role:false,scope:false};

  let role=false;
  const roleKey=String(meta.role_option||'').trim().toUpperCase();
  const rolePt=map.roles[roleKey];
  if(rolePt){
    drawVectorCheck(outPage,rolePt.x,rolePt.y,7.2,color);
    role=true;
  }

  const scopes=new Set(Array.isArray(meta.scope)?meta.scope:[]);
  let marked=0;
  for(const key of scopes){
    const pt=map.scope[key];
    if(!pt) continue;
    drawVectorCheck(outPage,pt.x,pt.y,7.2,color);
    marked++;
  }

  return {role,scope:scopes.size>0 && marked===scopes.size};
}

function markTextChoice(pageInfo,outPage,labels,color,side='left'){
  const target=findLabel(pageInfo,labels);
  if(!target) return false;
  const x=side==='right'?target.x+target.w+9:Math.max(5,target.x-9);
  const y=target.y+Math.max(target.h,8)*0.35;
  drawVectorCheck(outPage,x,y,6,color);
  return true;
}

function allExactText(pageInfo,label){
  const t=normPdfText(label);
  return pageInfo.items.map((it,idx)=>({it,idx,s:normPdfText(it.str),x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,h:Math.abs(it.transform?.[3]||10)})).filter(x=>x.s===t).sort((a,b)=>b.y-a.y);
}

function pdfLineGroups(pageInfo,tolerance=3.5){
  const entries=(pageInfo.items||[]).map((it,idx)=>({
    it,idx,
    raw:String(it.str||''),
    s:normPdfText(it.str),
    c:compactPdfText(it.str),
    x:it.transform?.[4]||0,
    y:it.transform?.[5]||0,
    w:it.width||0,
    h:Math.abs(it.transform?.[3]||10)
  })).filter(x=>x.s);

  const lines=[];
  for(const e of entries.sort((a,b)=>b.y-a.y || a.x-b.x)){
    let line=lines.find(l=>Math.abs(l.y-e.y)<=tolerance);
    if(!line){
      line={y:e.y,items:[]};
      lines.push(line);
    }
    line.items.push(e);
    line.y=(line.items.reduce((s,x)=>s+x.y,0)/line.items.length);
  }

  for(const line of lines){
    line.items.sort((a,b)=>a.x-b.x);
    line.text=line.items.map(x=>x.s).join(' ');
    line.compact=line.items.map(x=>x.c).join('');
  }
  return lines;
}

function findLabelSpan(pageInfo,labels){
  const lines=pdfLineGroups(pageInfo);

  for(const label of labels){
    const needle=compactPdfText(label);
    if(!needle) continue;

    for(const line of lines){
      const pos=line.compact.indexOf(needle);
      if(pos<0) continue;

      let cursor=0;
      const hit=[];
      for(const item of line.items){
        const len=item.c.length;
        const itemStart=cursor;
        const itemEnd=cursor+len;
        const needleEnd=pos+needle.length;
        if(len && itemEnd>pos && itemStart<needleEnd) hit.push(item);
        cursor=itemEnd;
      }
      if(!hit.length) continue;

      return {
        x:Math.min(...hit.map(x=>x.x)),
        y:hit.reduce((s,x)=>s+x.y,0)/hit.length,
        w:Math.max(...hit.map(x=>x.x+x.w))-Math.min(...hit.map(x=>x.x)),
        h:Math.max(...hit.map(x=>x.h)),
        lineText:line.text,
        matchedLabel:label,
        items:hit
      };
    }
  }

  // Fallback lama untuk label yang memang satu text item.
  const needles=labels.map(normPdfText);
  const arr=(pageInfo.items||[]).map((it,idx)=>({
    it,idx,s:normPdfText(it.str),x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0,h:Math.abs(it.transform?.[3]||10)
  }));
  for(const needle of needles){
    const exact=arr.find(x=>x.s===needle);
    if(exact) return exact;
    const partial=arr.find(x=>x.s.startsWith(needle) || x.s.includes(needle));
    if(partial) return partial;
  }
  return null;
}

function findLabel(pageInfo,labels){
  return findLabelSpan(pageInfo,labels);
}


const PDF_REQUIRED_STAMPS = {
  'PBD-A':['name','job_title','subject_taught','year_form'],
  'PBD-B':['name','job_title','subject_taught','year_form'],
  'PBD-C':['name','job_title','subject_taught','year_form'],
  'PPSI-A':['name','job_title'],
  'PPSI-B':['name','job_title'],
  'PPSI-C':['name','job_title'],
  'PAJSK-A':['name','job_title','school_name'],
  'PAJSK-B':['name','job_title','kokurikulum_unit'],
  'SEGAK-A':['school_name','school_code','name','role_option','scope'],
  'SEGAK-B':['school_name','school_code','name','role_option','scope'],
  'SEGAK-C':['school_name','school_code','name','role_option','scope']
};

function assertPdfStampAudit(instrumentId,audit){
  const required=PDF_REQUIRED_STAMPS[instrumentId]||[];
  const missing=required.filter(k=>!audit[k]);
  if(missing.length){
    const names={
      name:'Nama',
      job_title:'Jawatan',
      subject_taught:'Mata Pelajaran Diajar',
      year_form:'Tahun/Tingkatan',
      school_name:'Nama Sekolah',
      school_code:'Kod Sekolah',
      kokurikulum_unit:'Kelab/Persatuan/Sukan/Permainan/Pasukan Badan Beruniform',
      role_option:'Pilihan Jawatan',
      scope:'Skop SEGAK/BMI'
    };
    throw new Error(
      `PDF rasmi ${instrumentId} tidak dijana kerana mapping medan berikut gagal: `+
      missing.map(x=>names[x]||x).join(', ')+
      '. Sistem sengaja menghentikan muat turun supaya borang tidak keluar separuh lengkap.'
    );
  }
}

async function stampOfficialKpmPdf(detail){
  const sourceBytes=await loadOfficialKpmPdf();
  const sub=detail.submission;
  const items=detail.items||[];
  const instrumentId=sub.instrument_id;
  const {PDFDocument,rgb,StandardFonts}=await loadPdfLib();

  // Asingkan buffer scan dan buffer edit.
  // Ini elak error browser: "Cannot perform Construct on a detached ArrayBuffer".
  const scanBytes=sourceBytes.slice(0);
  const editBytes=sourceBytes.slice(0);
  const slice=await extractKpmPages(scanBytes,instrumentId);

  const srcDoc=await PDFDocument.load(editBytes);
  const outDoc=await PDFDocument.create();
  const indices=[];
  for(let p=slice.startPage;p<=slice.endPage;p++) indices.push(p-1);
  const copied=await outDoc.copyPages(srcDoc,indices);
  copied.forEach(p=>outDoc.addPage(p));

  const font=await outDoc.embedFont(StandardFonts.Helvetica);
  const bold=await outDoc.embedFont(StandardFonts.HelveticaBold);
  const black=rgb(0,0,0);

  const pageInfos=slice.pages;
  const anchors=sectionAwareItemAnchors(pageInfos,items);

  // BAHAGIAN A - isi semua medan yang diwajibkan oleh borang rasmi KPM.
  const firstInfo=pageInfos[0];
  const firstOut=outDoc.getPage(0);
  const meta=sub.metadata||{};

  const stampAudit={};

  function putAfter(labels,value,opts={}){
    if(!String(value||'').trim()) return false;
    const lab=findLabelSpan(firstInfo,labels);
    if(!lab) return false;

    const maxWidth=opts.maxWidth||290;
    let x=opts.x ?? (lab.x+lab.w+(opts.gap??10));
    x=Math.min(x,Math.max(8,firstOut.getWidth()-maxWidth-12));
    const y=opts.y ?? (lab.y-1);

    firstOut.drawText(String(value),{
      x,y,
      size:opts.size||8.7,
      font:opts.bold?bold:font,
      color:black,
      maxWidth
    });

    if(opts.key) stampAudit[opts.key]=true;
    return true;
  }

  if(instrumentId.startsWith('SEGAK-')){
    putAfter(['1. NAMA SEKOLAH:','1. NAMA SEKOLAH :','NAMA SEKOLAH:','NAMA SEKOLAH :','NAMA SEKOLAH'],window.PK_CONFIG.SCHOOL_OFFICIAL_NAME||'SEKOLAH KEBANGSAAN SUNGAI ABONG',{key:'school_name',maxWidth:360});
    putAfter(['2. KOD SEKOLAH:','2. KOD SEKOLAH :','KOD SEKOLAH:','KOD SEKOLAH :','KOD SEKOLAH'],window.PK_CONFIG.SCHOOL_CODE||'JBA5095',{key:'school_code',maxWidth:140});
    putAfter(['3. NAMA GURU:','3. NAMA GURU :','NAMA GURU:','NAMA GURU :','NAMA GURU','3. NAMA:','3. NAMA :'],sub.staff_name||'',{key:'name',maxWidth:330});

    // SEGAK mempunyai kotak checkbox sebenar pada halaman pertama.
    // Jangan lagi kira posisi berdasarkan teks; guna pusat kotak rasmi PDF KPM.
    const segakChecks=stampSegakHeaderCheckboxes(firstOut,instrumentId,meta,black);
    if(segakChecks.role) stampAudit.role_option=true;
    if(segakChecks.scope) stampAudit.scope=true;
  }else{
    putAfter(['1. NAMA:','1. NAMA :','NAMA:','NAMA :','NAMA'],sub.staff_name||'',{key:'name',maxWidth:340});
    putAfter(['2. JAWATAN:','2. JAWATAN :','JAWATAN:','JAWATAN :','JAWATAN'],sub.job_title||sub.target_role||'',{key:'job_title',maxWidth:250});

    if(instrumentId.startsWith('PBD-')){
      putAfter(['3. MATA PELAJARAN DIAJAR:','3. MATA PELAJARAN DIAJAR :','MATA PELAJARAN DIAJAR:','MATA PELAJARAN DIAJAR :','MATA PELAJARAN DIAJAR'],meta.subject_taught||'',{key:'subject_taught',maxWidth:300});
      putAfter(['4. TAHUN/TINGKATAN:','4. TAHUN/TINGKATAN :','TAHUN/TINGKATAN:','TAHUN/TINGKATAN :','TAHUN/TINGKATAN'],meta.year_form||'',{key:'year_form',maxWidth:260});
    }else if(instrumentId==='PAJSK-A'){
      putAfter(['3. SEKOLAH:','3. SEKOLAH :','SEKOLAH:','SEKOLAH :','SEKOLAH'],window.PK_CONFIG.SCHOOL_OFFICIAL_NAME||'SEKOLAH KEBANGSAAN SUNGAI ABONG',{key:'school_name',maxWidth:360});
    }else if(instrumentId==='PAJSK-B'){
      putAfter([
        '3. KELAB PERSATUAN / SUKAN PERMAINAN / PASUKAN BADAN BERUNIFORM:',
        'KELAB PERSATUAN / SUKAN PERMAINAN / PASUKAN BADAN BERUNIFORM:',
        'KELAB PERSATUAN / SUKAN PERMAINAN / PASUKAN BADAN BERUNIFORM',
        'KELAB PERSATUAN SUKAN PERMAINAN PASUKAN BADAN BERUNIFORM'
      ],meta.kokurikulum_unit||'',{key:'kokurikulum_unit',maxWidth:330,size:8.5,gap:12});
    }
  }

  // Semak mapping Bahagian A sebelum teruskan.
  // Jika satu medan wajib gagal dipetakan, hentikan PDF daripada dimuat turun.
  assertPdfStampAudit(instrumentId,stampAudit);

  // BAHAGIAN B & C - setiap jawapan WAJIB berjaya dimapping.
  // Kalau satu item gagal, PDF dihentikan supaya pengguna tidak menerima borang separuh lengkap.
  const answerFailures=[];
  const drawnAnswers=new Set();

  for(const q of items){
    let a=anchors.get(q.item_id) || specialSubitemAnchor(pageInfos,instrumentId,q);
    const answer=String(q.jawapan||'').trim().toUpperCase();

    if(!answer){
      answerFailures.push(`${q.bahagian} ${q.no_item}: tiada jawapan`);
      continue;
    }
    if(!validateAnswerValue(q)){
      answerFailures.push(`${q.bahagian} ${q.no_item}: jawapan lama "${answer}" tidak sepadan dengan ${q.jenis_respons}`);
      continue;
    }
    if(!a){
      answerFailures.push(`${q.bahagian} ${q.no_item}: baris PDF tidak dijumpai`);
      continue;
    }

    const pInfo=pageInfos[a.pi];
    const outPage=outDoc.getPage(a.pi);

    if(q.jenis_respons==='YA_TIDAK'){
      const target=findAnswerTarget(pInfo,a,q);
      if(!target){
        answerFailures.push(`${q.bahagian} ${q.no_item}: petak Ya/Tidak tidak dijumpai`);
        continue;
      }
      const pt=yaTidakCheckboxPoint(pageInfos,a.pi,a,target,q);
      if(!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)){
        answerFailures.push(`${q.bahagian} ${q.no_item}: koordinat Ya/Tidak tidak sah`);
        continue;
      }
      drawVectorCheck(outPage,pt.x,pt.y,6.2,black);
      drawnAnswers.add(q.item_id);
    }else if(q.jenis_respons==='SKALA_1_5'){
      const centers=nearestScaleCenters(pageInfos,a.pi,a.y);
      if(!centers || centers.length!==5 || centers.some(x=>!Number.isFinite(x))){
        answerFailures.push(`${q.bahagian} ${q.no_item}: grid skala 1-5 tidak dijumpai`);
        continue;
      }

      const repair=KPM_SOURCE_REPAIRS[kpmItemKey(instrumentId,q)]||null;
      const baseline=a.y-1;

      // Betulkan kecacatan/omisi yang memang wujud dalam PDF asal KPM.
      if(repair?.injectScaleLabels){
        centers.forEach((cx,i)=>{
          outPage.drawText(String(i+1),{
            x:cx-2.4,y:baseline,size:8,font,color:black
          });
        });
      }
      if(repair?.rewriteScaleLabels){
        const cx=centers[4];
        outPage.drawRectangle({x:cx-5.2,y:baseline-2.2,width:10.4,height:11,color:rgb(1,1,1)});
        outPage.drawText('5',{x:cx-2.4,y:baseline,size:8,font,color:black});
      }

      const chosen=centers[Number(answer)-1];
      const cy=a.y+Math.max(a.h||8,8)*0.30;
      outPage.drawEllipse({
        x:chosen,y:cy,
        xScale:8.2,yScale:7,
        borderColor:black,borderWidth:1.3
      });
      drawnAnswers.add(q.item_id);
    }else{
      answerFailures.push(`${q.bahagian} ${q.no_item}: jenis respons tidak dikenali`);
      continue;
    }

    if(String(q.catatan||'').trim()){
      const pageW=outPage.getWidth();
      outPage.drawText(String(q.catatan).slice(0,100),{
        x:pageW*0.82,y:a.y-1,size:6.6,font,color:black,maxWidth:pageW*0.16
      });
    }
  }

  if(answerFailures.length || drawnAnswers.size!==items.length){
    const detail=answerFailures.slice(0,8).join('; ');
    throw new Error(
      `PDF rasmi ${instrumentId} dihentikan kerana audit jawapan gagal. `+
      `${detail}${answerFailures.length>8?' …':''}. `+
      `Sila KEMASKINI instrumen jika ada jawapan lama yang perlu dipilih semula.`
    );
  }

  // Tandatangan, nama dan tarikh pada ruang asal KPM di halaman terakhir.
  const lastIndex=outDoc.getPageCount()-1;
  const lastPage=outDoc.getPage(lastIndex);
  const lastInfo=pageInfos[pageInfos.length-1];

  const sigLabel=findLabel(lastInfo,['TANDATANGAN :','TANDATANGAN:','TANDATANGAN']);
  const nameLabels=lastInfo.items.map((it,idx)=>({it,idx,s:normPdfText(it.str),x:it.transform?.[4]||0,y:it.transform?.[5]||0,w:it.width||0}))
    .filter(x=>x.s==='NAMA :'||x.s==='NAMA:'||x.s==='NAMA')
    .sort((a,b)=>a.y-b.y);
  const dateLabel=findLabel(lastInfo,['TARIKH :','TARIKH:','TARIKH']);

  if(sigLabel && sub.signature_data_url){
    try{
      const b64=sub.signature_data_url.split(',')[1]||'';
      const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
      const img=await outDoc.embedPng(bytes);
      const x=Math.min(sigLabel.x+sigLabel.w+12,lastPage.getWidth()-130);
      const y=Math.max(20,sigLabel.y-28);
      lastPage.drawImage(img,{x,y,width:110,height:38});
    }catch(err){console.warn('Signature stamp failed',err)}
  }
  const sigName=nameLabels.length?nameLabels[0]:null;
  if(sigName && (sub.signer_name||sub.staff_name)){
    lastPage.drawText(String(sub.signer_name||sub.staff_name),{
      x:Math.min(sigName.x+sigName.w+12,lastPage.getWidth()-260),
      y:sigName.y-1,size:8.5,font,color:black,maxWidth:250
    });
  }
  if(dateLabel){
    const dt=sub.signed_at||sub.submitted_at;
    const dateText=dt?new Date(dt).toLocaleDateString('ms-MY'):'';
    if(dateText){
      lastPage.drawText(dateText,{
        x:Math.min(dateLabel.x+dateLabel.w+12,lastPage.getWidth()-120),
        y:dateLabel.y-1,size:8.5,font,color:black,maxWidth:110
      });
    }
  }

  const bytes=await outDoc.save();
  return bytes;
}

async function downloadSubmissionPdf(submissionId){
  showLoader('Menjana PDF Rasmi KPM…','Mengisi jawapan pada borang asal KPM. Jangan tutup halaman ini.');
  try{
    const detail=await submissionDetail(submissionId);
    const sub=detail.submission;
    if(!sub || sub.status!=='SUBMITTED') throw new Error('PDF hanya tersedia selepas instrumen dihantar.');
    const missingMeta=missingMetadataFields(sub.instrument_id,defaultMetadata(sub.instrument_id,sub.metadata||{}));
    if(missingMeta.length){
      throw new Error(`Borang lama ini belum lengkap Bahagian A (${missingMeta.map(x=>META_LABELS[x]||x).join(', ')}). Pemilik perlu klik KEMASKINI, lengkapkan maklumat dan Hantar semula.`);
    }

    const bytes=await stampOfficialKpmPdf(detail);
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const safeName=String(sub.staff_name||'guru').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'');
    a.href=url;
    a.download=`${sub.instrument_id}_${safeName}_${sub.year||''}_KPM.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(err){
    console.error(err);
    toast(err.message||'Gagal menjana PDF rasmi KPM.');
  }finally{
    hideLoader();
  }
}

async function viewSettings(){
  title('Tahun / Tetapan');
  if(!state.boot) await loadBoot();
  const sessions=state.boot.sessions||[];
  $('#view').innerHTML=`<div class="grid grid2">
    <div class="card"><h2>Buka Tahun Baharu</h2><p class="muted">Sesi, kitaran dan tugasan bundle akan dijana automatik dalam Neon.</p>
      <div class="toolbar"><input id="newYear" type="number" min="2026" max="2100" value="${Number(state.boot.config.TAHUN_AKTIF||2026)+1}" style="max-width:160px"><button id="openYear" class="btn btn-primary">Buka Tahun</button></div>
    </div>
    <div class="card"><h2>Sesi Tersedia</h2>${sessions.map(s=>`<div>${esc(s.nama||s.name)} <span class="badge ${s.session_id===state.boot.config.ACTIVE_SESSION_ID?'ok':'gray'}">${s.session_id===state.boot.config.ACTIVE_SESSION_ID?'AKTIF':'ARKIB'}</span></div>`).join('<hr>')}</div>
  </div>`;
  $('#openYear').onclick=async()=>{
    const y=Number($('#newYear').value);
    if(!confirm(`Buka sesi ${y}?`))return;
    const out=await post('open_year',{tahun:y});
    if(!out.ok){toast(out.message||out.error);return}
    toast(`Sesi ${y} kini aktif. ${out.assignments_created||0} tugasan bundle disediakan.`);
    await loadBoot(); viewSettings();
  };
}

function modal(inner){
  const el=document.createElement('div'); el.className='modal-backdrop'; el.id='modal';
  el.innerHTML=`<div class="modal">${inner}</div>`;
  document.body.appendChild(el);
}
function closeModal(){ $('#modal')?.remove(); }

start();

setTimeout(()=>{ if(document.getElementById('bootSplash')) dismissBootSplash(); }, 2500);
