
const API = window.PK_CONFIG.API_URL;
const state = {
  token: localStorage.getItem('pk_token') || '',
  user: JSON.parse(localStorage.getItem('pk_user') || 'null'),
  boot: null,
  assignments: JSON.parse(localStorage.getItem('pk_assignments') || '[]'),
  route: 'assignments',
  currentAssignment: null,
  currentSubmission: null,
  currentItems: [],
  currentResponses: {},
  saveTimer: null
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(msg){
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  $('#toast').appendChild(el); setTimeout(()=>el.remove(),3500);
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

async function get(action, params={}, opts={}){
  const u=new URL(API);
  u.searchParams.set('action',action);
  if(state.token) u.searchParams.set('token',state.token);
  Object.entries(params).forEach(([k,v])=>v!==undefined&&v!==null&&u.searchParams.set(k,v));
  const r=await fetch(u,{redirect:'follow'});
  return r.json();
}

async function post(action,payload={}){
  const r=await fetch(API,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action,token:state.token,payload})
  });
  return r.json();
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
  // SPEED: UI muncul terus. Jangan tunggu Apps Script health check.
  if(!state.token || !state.user){
    renderLogin();
    return;
  }

  // Jika pernah login, shell + tugasan cache dipaparkan serta-merta.
  showLoader('Memuatkan Sistem…','Menyediakan paparan anda.');
  state.route='assignments';
  renderShell();
  hideLoader();

  // Semak token / refresh tugasan di belakang.
  refreshAssignments(true).catch(()=>{
    logout();
  });
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
  if(route==='settings') return viewSettings();
}

function title(t){ $('#pageTitle').textContent=t; }

async function viewDashboard(){
  title('Dashboard');
  if(!state.boot) await loadBoot();
  const d=await get('dashboard');
  const s=d.stats||{};
  $('#view').innerHTML=`<div class="grid grid4">
    ${stat('Tugasan',s.assignments||0)}
    ${stat('Selesai',s.submitted||0)}
    ${stat('Draf',s.draft||0)}
    ${stat('Tindakan Susulan',s.open_followups||0)}
  </div>
  <div class="section-title"><h2>Sesi Aktif</h2></div>
  <div class="card">
    <b>${esc(state.boot.active_session?.nama||'-')}</b>
    <p class="muted">Tahun aktif: ${esc(state.boot.config.TAHUN_AKTIF||'-')}</p>
    <div class="toolbar">
      <button class="btn btn-primary" onclick="go('assignments')">Buka Instrumen Saya</button>
    </div>
  </div>`;
}

function stat(label,value){
  return `<div class="card stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
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

  if(rows.length===1){
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
      return `<div class="assignment">
        <div><h3>${esc(a.instrument?.tajuk||a.instrument_id)}</h3>
        <p>${esc(a.instrument_id)} · ${esc(a.cycle_id||'')}</p></div>
        <div class="toolbar">
          <span class="badge ${st==='SUBMITTED'?'ok':st==='DRAFT'?'warn':'gray'}">${esc(st)}</span>
          ${a.submission?.pdf_url?`<a class="btn btn-light" target="_blank" href="${esc(a.submission.pdf_url)}">PDF</a>`:''}
          <button class="btn btn-primary" data-open="${esc(a.assignment_id)}">${st==='SUBMITTED'?'Lihat':'Isi'}</button>
        </div>
      </div>`;
    }).join(''):`<div class="card muted">Belum ada tugasan instrumen untuk anda.</div>`}
  </div>`;
  $$('[data-open]').forEach(b=>b.onclick=()=>openAssignment(b.dataset.open,rows));
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
  state.currentItems=out.items||[];
  state.currentResponses={};
  (out.responses||[]).forEach(r=>state.currentResponses[r.item_id]=r);

  renderForm(out.assignment,out.submission);
}

function renderForm(a,sub){
  title(a.instrument?.tajuk||a.instrument_id);
  const status=sub?.status||'OPEN';
  const locked=String(status).toUpperCase()==='SUBMITTED';
  let lastSection='';
  const html=state.currentItems.map(item=>{
    const r=state.currentResponses[item.item_id]||{};
    let section='';
    const sec=`${item.bahagian} — ${item.seksyen}`;
    if(sec!==lastSection){lastSection=sec;section=`<div class="section-title"><h2>${esc(sec)}</h2></div>`}
    return section+renderItem(item,r,locked);
  }).join('');

  $('#view').innerHTML=`<div class="toolbar" style="margin-bottom:14px">
    <button class="btn btn-light" id="backAssign">← Kembali</button>
    <span class="badge ${locked?'ok':'gray'}">${esc(status)}</span>
    <span id="saveState" class="muted"></span>
    ${sub?.pdf_url?`<a href="${esc(sub.pdf_url)}" target="_blank" class="btn btn-light">Buka PDF</a>`:''}
  </div>
  <div class="card">${html}</div>
  ${locked?'':`<div class="card" style="margin-top:16px">
    <div class="form-row"><div><label>Nama Penandatangan</label><input id="signer" value="${esc(state.user.nama)}"></div></div>
    <div class="toolbar" style="margin-top:14px"><button id="submitForm" class="btn btn-success">Hantar & Jana PDF</button></div>
  </div>`}`;

  $('#backAssign').onclick=()=>viewAssignments();
  if(!locked){
    $$('[data-item]').forEach(el=>{
      el.onchange=handleAnswerChange;
      if(el.tagName==='TEXTAREA') el.oninput=handleAnswerChange;
    });
    $('#submitForm').onclick=submitCurrent;
  }
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
    <div class="meta">${esc(item.jenis_respons)}${item.wajib==='TRUE'?' · wajib':''}</div>
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
    state.currentSubmission={submission_id:out.submission_id,status:'DRAFT'};
  }
  $('#saveState').textContent=out.ok?'Disimpan':'Gagal simpan';
  return out;
}

async function submitCurrent(){
  const saved=await saveCurrentResponses();
  const signer=$('#signer').value.trim();
  if(!signer){toast('Isi nama penandatangan.');return}
  if(!state.currentSubmission?.submission_id){
    toast('Jawab sekurang-kurangnya satu item dahulu sebelum hantar.');
    return;
  }
  const out=await post('submit_submission',{submission_id:state.currentSubmission.submission_id,nama_penandatangan:signer},{loading:true,title:'Menghantar Instrumen…',desc:'Sedang menjana hantaran dan PDF.'});
  if(!out.ok){
    if(out.error==='INCOMPLETE') toast(`Masih ada ${out.missing_item_ids.length} item wajib belum dijawab.`);
    else toast(out.message||out.error);
    return;
  }
  toast(out.warning||'Berjaya dihantar.');
  await viewAssignments();
}

async function viewStaff(){
  title('Pengurusan Guru');
  const out=await get('staff',{}, {loading:true,title:'Memuatkan Senarai Guru…',desc:'Sedang mendapatkan data guru.'});
  const rows=out.staff||[];
  $('#view').innerHTML=`<div class="section-title"><h2>Senarai Guru</h2><button class="btn btn-primary" id="addStaff">+ Tambah Guru</button></div>
  <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Jawatan</th><th>Panitia</th><th>Admin</th><th></th></tr></thead><tbody>
    ${rows.map(s=>`<tr><td>${esc(s.nama)}</td><td>${esc(s.email)}</td><td>${esc(s.jawatan_hakiki)}</td><td>${esc(s.panitia)}</td><td>${s.is_admin?'Ya':'Tidak'}</td><td><button class="btn btn-light" data-edit="${esc(s.staff_id)}">Edit</button></td></tr>`).join('')}
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
        <div class="teacher-check-list" id="teacherList">${staff.map(s=>`<label class="teacher-check" data-name="${esc(String(s.nama).toLowerCase())}"><input type="checkbox" class="bundle-member" value="${esc(s.staff_id)}" ${selectedMembers.has(s.staff_id)?'checked':''}><span><b>${esc(s.nama)}</b><small>${esc(s.jawatan_hakiki||'')}</small></span></label>`).join('')}</div>
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
  const [staffOut,own] = await Promise.all([get('staff'), get('assignments',{staff_id:state.user.staff_id})]);
  const staff=staffOut.staff||[];
  const inst=state.boot.instruments||[];
  const cycles=state.boot.cycles||[];

  $('#view').innerHTML=`<div class="card">
    <div class="form-row">
      <div><label>Guru</label><select id="aStaff">${staff.map(s=>`<option value="${esc(s.staff_id)}">${esc(s.nama)}</option>`).join('')}</select></div>
      <div><label>Instrumen</label><select id="aInst">${inst.map(i=>`<option value="${esc(i.instrument_id)}">${esc(i.tajuk)}</option>`).join('')}</select></div>
      <div><label>Kitaran</label><select id="aCycle">${cycles.map(c=>`<option value="${esc(c.cycle_id)}">${esc(c.nama_kitaran)}</option>`).join('')}</select></div>
      <div><label>Tarikh akhir</label><input id="aDate" type="date"></div>
    </div>
    <div class="toolbar" style="margin-top:14px"><button id="createAsn" class="btn btn-primary">Cipta Tugasan</button></div>
  </div>
  <div class="section-title"><h2>Tip</h2></div>
  <div class="card muted">Gunakan tugasan untuk menentukan instrumen mana perlu diisi oleh setiap guru. Sistem akan pilih versi instrumen yang aktif untuk tahun semasa.</div>`;
  $('#createAsn').onclick=async()=>{
    const out=await post('create_assignment',{
      staff_id:$('#aStaff').value,instrument_id:$('#aInst').value,cycle_id:$('#aCycle').value,tarikh_akhir:$('#aDate').value
    });
    toast(out.ok?(out.created?'Tugasan dicipta.':'Tugasan sudah wujud.'):(out.message||out.error));
  };
}

async function viewSubmissions(){
  title('Hantaran');
  const out=await get('submissions',{}, {loading:true,title:'Memuatkan Hantaran…',desc:'Sedang mendapatkan rekod hantaran.'});
  const rows=out.submissions||[];
  $('#view').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Guru</th><th>Instrumen</th><th>Status</th><th>Tarikh Hantar</th><th>PDF</th><th>Tindakan</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.staff_name)}</td><td>${esc(r.instrument_title||r.instrument_id)}</td><td><span class="badge ${r.status==='SUBMITTED'?'ok':'warn'}">${esc(r.status)}</span></td><td>${esc(r.tarikh_hantar||'-')}</td><td>${r.pdf_url?`<a class="btn btn-light" target="_blank" href="${esc(r.pdf_url)}">Buka</a>`:'-'}</td><td>${r.status==='DRAFT'?`<button class="btn btn-danger" data-del-draft="${esc(r.submission_id)}">Padam Draf</button>`:'-'}</td></tr>`).join('')}
  </tbody></table></div>`;
  $$('[data-del-draft]').forEach(b=>b.onclick=async()=>{
    if(!confirm('Padam draf ini?')) return;
    const res=await post('delete_submission',{submission_id:b.dataset.delDraft},{loading:true,title:'Memadam Draf…',desc:'Sedang membuang rekod draf ujian.'});
    if(!res.ok){toast(res.message||res.error||'Gagal padam draf.');return}
    toast('Draf dipadam.');
    await viewSubmissions();
  });
}

async function viewSettings(){
  title('Tahun / Tetapan');
  if(!state.boot) await loadBoot();
  const sessions=state.boot.sessions||[];
  $('#view').innerHTML=`<div class="grid grid2">
    <div class="card"><h2>Buka Tahun Baharu</h2><p class="muted">Folder Drive, sesi dan kitaran pertama akan dijana automatik.</p>
      <div class="toolbar"><input id="newYear" type="number" min="2026" max="2100" value="${Number(state.boot.config.TAHUN_AKTIF||2026)+1}" style="max-width:160px"><button id="openYear" class="btn btn-primary">Buka Tahun</button></div>
    </div>
    <div class="card"><h2>Sesi Tersedia</h2>${sessions.map(s=>`<div>${esc(s.nama)} <span class="badge ${s.session_id===state.boot.config.ACTIVE_SESSION_ID?'ok':'gray'}">${s.session_id===state.boot.config.ACTIVE_SESSION_ID?'AKTIF':'ARKIB'}</span></div>`).join('<hr>')}</div>
  </div>`;
  $('#openYear').onclick=async()=>{
    const y=Number($('#newYear').value);
    if(!confirm(`Buka sesi ${y}?`))return;
    const out=await post('open_year',{tahun:y});
    if(!out.ok){toast(out.message||out.error);return}
    toast(out.created?`Sesi ${y} berjaya dicipta.`:`Sesi ${y} sudah wujud dan kini aktif.`);
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
