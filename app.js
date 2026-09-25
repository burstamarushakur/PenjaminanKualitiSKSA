
const API = window.PK_CONFIG.API_URL;
const state = {
  token: localStorage.getItem('pk_token') || '',
  user: JSON.parse(localStorage.getItem('pk_user') || 'null'),
  boot: null,
  route: 'dashboard',
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

async function get(action, params={}){
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
  state.token=data.token; state.user=data.user;
  localStorage.setItem('pk_token',data.token);
  localStorage.setItem('pk_user',JSON.stringify(data.user));
}

function logout(){
  state.token=''; state.user=null; state.boot=null;
  localStorage.removeItem('pk_token'); localStorage.removeItem('pk_user');
  renderLogin();
}

async function start(){
  try{
    const health=await get('health');
    if(!health.ok) throw new Error('API tidak memberi respons.');
  }catch(e){
    renderFatal('Tak dapat hubungi Apps Script API. Pastikan deployment Web App aktif dan URL betul.');
    return;
  }

  if(!state.token){
    renderLogin();
    return;
  }

  const who=await get('whoami');
  if(!who.ok){ logout(); return; }
  state.user=who.user;
  await loadBoot();
  renderShell();
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
  const status=await get('setup_status').catch(()=>({has_admin:true}));
  const first=!status.has_admin;

  $('#app').innerHTML=`<div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <img class="school-logo" src="https://i.postimg.cc/3RF9M05N/Logo-SKSA.png" alt="Logo SK Sungai Abong">
      </div>
      <h1>${first?'Setup Pentadbir Pertama':'Log Masuk'}</h1>
      <p class="system-title">${first?'Buat akaun pentadbir pertama sistem.':'SISTEM DIGITAL PENJAMINAN KUALITI SK SG ABONG'}</p>
      <form id="loginForm" class="stack">
        ${first?`<div><label>Nama</label><input id="name" required></div>`:''}
        <div><label>Email</label><input id="email" type="email" required></div>
        <div><label>PIN (4–8 digit)</label><input id="pin" inputmode="numeric" pattern="\\d{4,8}" required></div>
        <button class="btn btn-primary" type="submit">${first?'Cipta Pentadbir':'Log Masuk'}</button>
      </form>
    </div>
  </div>`;

  $('#loginForm').onsubmit=async e=>{
    e.preventDefault();
    const payload={email:$('#email').value.trim(),pin:$('#pin').value.trim()};
    if(first) payload.nama=$('#name').value.trim();
    const out=await post(first?'setup_admin':'login',payload);
    if(!out.ok){toast(out.message||out.error||'Log masuk gagal');return}
    setSession(out); await loadBoot(); renderShell();
  };
}

function renderShell(){
  const admin=state.user?.is_admin;
  $('#app').innerHTML=`<div class="shell">
    <aside class="sidebar">
      <div class="brand">${esc(window.PK_CONFIG.APP_NAME)}<small>${esc(window.PK_CONFIG.SCHOOL_NAME)}</small></div>
      <div class="nav">
        <button data-route="dashboard">Dashboard</button>
        <button data-route="assignments">Instrumen Saya</button>
        ${admin?`<button data-route="staff">Guru</button>
        <button data-route="adminAssignments">Tugasan</button>
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
  if(route==='adminAssignments') return viewAdminAssignments();
  if(route==='submissions') return viewSubmissions();
  if(route==='settings') return viewSettings();
}

function title(t){ $('#pageTitle').textContent=t; }

async function viewDashboard(){
  title('Dashboard');
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
  const out=await get('assignments');
  const rows=out.assignments||[];
  $('#view').innerHTML=`<div class="stack" id="assignmentList">
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

async function openAssignment(id,rows){
  const a=rows.find(x=>x.assignment_id===id); if(!a)return;
  state.currentAssignment=a;

  let sub=a.submission;
  if(!sub){
    const s=await post('start_submission',{assignment_id:id});
    if(!s.ok){toast(s.message||s.error);return}
    sub=s.submission;
  }
  state.currentSubmission=sub;

  const [itemsOut,subOut]=await Promise.all([
    get('items',{instrument_id:a.instrument_id,version_id:a.version_id}),
    get('submission',{submission_id:sub.submission_id})
  ]);
  state.currentItems=itemsOut.items||[];
  state.currentResponses={};
  (subOut.responses||[]).forEach(r=>state.currentResponses[r.item_id]=r);

  renderForm(a,sub);
}

function renderForm(a,sub){
  title(a.instrument?.tajuk||a.instrument_id);
  const locked=String(sub.status).toUpperCase()==='SUBMITTED';
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
    <span class="badge ${locked?'ok':'warn'}">${esc(sub.status)}</span>
    <span id="saveState" class="muted"></span>
    ${sub.pdf_url?`<a href="${esc(sub.pdf_url)}" target="_blank" class="btn btn-light">Buka PDF</a>`:''}
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
  const out=await post('save_responses',{submission_id:sub.submission_id,responses});
  $('#saveState').textContent=out.ok?'Disimpan':'Gagal simpan';
}

async function submitCurrent(){
  await saveCurrentResponses();
  const signer=$('#signer').value.trim();
  if(!signer){toast('Isi nama penandatangan.');return}
  const out=await post('submit_submission',{submission_id:state.currentSubmission.submission_id,nama_penandatangan:signer});
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
  const out=await get('staff');
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
      <div><label>PIN baharu ${s?'(kosong = kekal)':''}</label><input id="sPin" inputmode="numeric" pattern="\\d{4,8}" ${s?'':'required'}></div>
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
    if($('#sPin').value.trim()) payload.pin=$('#sPin').value.trim();
    const out=await post('upsert_staff',payload);
    if(!out.ok){toast(out.message||out.error);return}
    closeModal(); toast('Guru disimpan.'); viewStaff();
  };
}

async function viewAdminAssignments(){
  title('Tugasan Instrumen');
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
  const out=await get('submissions');
  const rows=out.submissions||[];
  $('#view').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Guru</th><th>Instrumen</th><th>Status</th><th>Tarikh Hantar</th><th>PDF</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.staff_name)}</td><td>${esc(r.instrument_title||r.instrument_id)}</td><td><span class="badge ${r.status==='SUBMITTED'?'ok':'warn'}">${esc(r.status)}</span></td><td>${esc(r.tarikh_hantar||'-')}</td><td>${r.pdf_url?`<a class="btn btn-light" target="_blank" href="${esc(r.pdf_url)}">Buka</a>`:'-'}</td></tr>`).join('')}
  </tbody></table></div>`;
}

async function viewSettings(){
  title('Tahun / Tetapan');
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
