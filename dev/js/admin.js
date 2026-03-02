// ═══════════════════════════════════════════════════════
// admin.js — NutriControl
// Admin pages: overview, rules management (CRUD), user management (CRUD)
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function renderAdmin(){
  buildMonthScroller('admin-month-scroller',adminCurrentMonth||tmKey(),'selectAdminMonth');
  renderAdminOverview();renderRulesList();renderAdminSettings();
}
function showAdminNav(sub,btn){
  showAdminSub(sub);
  document.querySelectorAll('#nav-admin .nav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
function showAdminSub(sub){
  ['overview','detail','rules','settings'].forEach(s=>{
    const el=document.getElementById('admin-sub-'+s);
    if(el)el.classList.toggle('hidden',s!==sub);
  });
}
function selectAdminMonth(key){
  adminCurrentMonth=key;
  buildMonthScroller('admin-month-scroller',key,'selectAdminMonth');
  renderAdminOverview();
}
function renderAdminOverview(){
  const users=_users.filter(u=>u.role==='nutritionist');
  const logs=_logs;
  const monthKey=adminCurrentMonth||tmKey();
  const [y,mo]=monthKey.split('-').map(Number);
  const target=calcMonthlyTarget(y,mo-1);
  const el=document.getElementById('admin-nutri-list');
  if(!users.length){el.innerHTML='<p class="text-muted">אין תזונאים עדיין.</p>';return;}
  el.innerHTML=users.map(u=>{
    const ul=logs.filter(l=>l.userId===u.id&&l.date.startsWith(monthKey));
    const pts=ul.reduce((s,l)=>s+parseFloat(l.points||0),0);
    const pct=Math.min(100,Math.round(pts/target*100));
    const pay=calcPay(u,pts,target);
    return '<div class="nutri-row" onclick="showNutriDetail(\''+u.id+'\')">'+
      '<div class="nutri-avatar">'+u.avatar+'</div>'+
      '<div class="nutri-info">'+
        '<div class="nutri-name">'+u.name+'</div>'+
        '<div class="nutri-meta">'+ul.length+' פעילויות | ₪'+pay+'</div>'+
        '<div class="mini-bar"><div class="mini-bar-fill" style="width:'+pct+'%"></div></div>'+
      '</div>'+
      '<div class="nutri-pts"><div class="pts-num">'+fmtPts(pts)+'</div><div class="pts-pct">'+pct+'%</div></div>'+
    '</div>';
  }).join('');
}
function showNutriDetail(userId){
  const user=_users.find(u=>u.id===userId);if(!user)return;
  const logs=_logs.filter(l=>l.userId===userId);
  const monthKey=adminCurrentMonth||tmKey();
  const [y,mo]=monthKey.split('-').map(Number);
  const target=calcMonthlyTarget(y,mo-1);
  const ml=logs.filter(l=>l.date.startsWith(monthKey));
  const pts=ml.reduce((s,l)=>s+parseFloat(l.points||0),0);
  const pct=Math.min(100,Math.round(pts/target*100));
  const pay=calcPay(user,pts,target),maxPay=getMaxPay(user);
  const sv=user.seniority||0;
  const scope=user.scope||100;
  const sLabel=sv<2?'0-2 שנות ותק':sv<4?'2-4 שנות ותק':'4+ שנות ותק';
  document.getElementById('nutri-detail-content').innerHTML=
    '<div class="page-title">'+user.name+'</div>'+
    '<p class="page-subtitle">'+sLabel+' | '+scope+'% משרה | יעד: '+target+' נק. | '+MHE[mo-1]+' '+y+'</p>'+
    '<div class="points-hero" style="margin-bottom:16px">'+
      '<div class="month-label">'+MHE[mo-1]+' '+y+'</div>'+
      '<div class="points-main"><div class="points-number">'+fmtPts(pts)+'</div><div class="points-target">/ '+target+'</div></div>'+
      '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="progress-label">'+pct+'% מהיעד החודשי</div>'+
    '</div>'+
    '<div class="card" style="margin-bottom:16px">'+
      '<div class="card-title">💰 אמדן שכר חודשי</div>'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'+
        '<span style="font-size:13px;color:var(--text-muted)">'+sLabel+'</span>'+
        '<span style="font-size:13px;color:var(--text-muted)">מקסימום: ₪'+maxPay+'</span>'+
      '</div>'+
      '<div style="font-family:\'DM Serif Display\',serif;font-size:38px;color:var(--primary)">₪ '+pay+'</div>'+
      '<div class="progress-bar-wrap" style="margin-top:10px;background:var(--border)"><div class="progress-bar-fill" style="width:'+pct+'%"></div></div>'+
    '</div>'+
    '<div class="card-title">פעילויות החודש</div>'+
    (ml.length?'<div class="card" style="padding:8px 20px">'+ml.map(l=>activityHTML(l,false)).join('')+'</div>':'<p class="text-muted">אין פעילויות החודש.</p>');
  showAdminSub('detail');
}

// ═══ RULES ═══
function renderRulesList(){
  const groups=[
    {cat:'assessment',label:'הערכה תזונתית',icon:'📊'},
    {cat:'followup',label:'מעקב חוזר',icon:'🔄'},
    {cat:'general',label:'כללי',icon:'📋'},
    {cat:'non-clinical',label:'פעולות לא טיפוליות',icon:'⏱'},
  ];
  const rules=_rules;
  let html='';
  groups.forEach(g=>{
    const gr=rules.filter(r=>r.category===g.cat);
    if(!gr.length)return;
    html+='<div class="card-title" style="margin-top:16px">'+g.icon+' '+g.label+'</div>';
    html+=gr.map(r=>{
      const isNC=r.category==='non-clinical';
      const ptsLabel=isNC?'לפי זמן':fmtPts(r.points)+' נק.';
      return '<div class="rule-card">'+
        '<div class="rule-icon">'+(r.icon||'📋')+'</div>'+
        '<div class="rule-info"><div class="rule-name">'+r.name+'</div><div class="rule-desc">'+ptsLabel+'</div></div>'+
        '<div style="display:flex;gap:6px;align-items:center">'+
          '<button onclick="showEditRuleModal(\''+r.id+'\')" style="background:var(--accent-light);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px">✏️</button>'+
          '<button onclick="deleteRule(\''+r.id+'\')" style="background:var(--danger-light);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;color:var(--danger)">🗑</button>'+
        '</div>'+
      '</div>';
    }).join('');
  });
  document.getElementById('rules-list').innerHTML=html;
}
function showAddRuleModal(){
  let html='<div class="modal-title">הוסף כלל נקודות</div>';
  html+='<div class="form-group"><label>סוג פעילות</label><select id="nr-cat" onchange="toggleRuleFields()"><option value="assessment">הערכה תזונתית</option><option value="followup">מעקב חוזר</option><option value="general">כללי</option><option value="non-clinical">פעולות לא טיפוליות</option></select></div>';
  html+='<div class="form-group"><label>שם הפעילות</label><input type="text" id="nr-name" placeholder="לדוגמה: ייעוץ תזונתי"></div>';
  html+='<div class="form-group"><label>סמל</label><input type="text" id="nr-icon" value="📋" maxlength="2"></div>';
  html+='<div class="form-group" id="nr-pts-group"><label>נקודות</label><input type="number" id="nr-pts" placeholder="1" min="0.5" step="0.5"></div>';
  html+='<div id="nr-nc-note" style="display:none;background:var(--accent-light);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--primary);margin-bottom:12px">⏱ ניקוד אוטומטי: נקודה לכל 30 דקות</div>';
  html+='<button class="btn btn-primary" id="nr-save-btn">שמור כלל</button>';
  openModal(html);
  document.getElementById('nr-save-btn').onclick=saveNewRule;
}
function toggleRuleFields(){
  const isNC=document.getElementById('nr-cat')?.value==='non-clinical';
  const pg=document.getElementById('nr-pts-group');
  const note=document.getElementById('nr-nc-note');
  if(pg)pg.style.display=isNC?'none':'block';
  if(note)note.style.display=isNC?'block':'none';
}
async function saveNewRule(){
  const name=(document.getElementById('nr-name')?.value||'').trim();
  const cat=document.getElementById('nr-cat')?.value||'assessment';
  const isNC=cat==='non-clinical';
  const pts=isNC?1:parseFloat(document.getElementById('nr-pts')?.value||0);
  if(!name){showToast('נא למלא שם פעילות');return;}
  if(!isNC&&(isNaN(pts)||pts<=0)){showToast('נא למלא נקודות תקינות');return;}
  const icon=(document.getElementById('nr-icon')?.value||'').trim()||'📋';
  const pType=isNC?'per30min':'fixed';
  try{
    const r=await sbInsert('rules',{id:'r'+Date.now(),name,category:cat,icon,points:pts,points_type:pType});
    _rules.push({...r,pointsType:r.points_type});
    closeModal();renderRulesList();
    if(document.getElementById('page-log').classList.contains('active'))initLogPage();
    showToast('הכלל נוסף!');
  }catch(e){showToast('שגיאה: '+e.message);}
}
async function deleteRule(id){
  if(!confirm('להסיר כלל זה?'))return;
  try{
    await sbDelete('rules',id);
    _rules=_rules.filter(r=>r.id!==id);
    renderRulesList();
    if(document.getElementById('page-log').classList.contains('active'))initLogPage();
    showToast('הכלל הוסר');
  }catch(e){showToast('שגיאה: '+e.message);}
}
function showEditRuleModal(id){
  const r=_rules.find(r=>r.id===id);if(!r)return;
  const isNC=r.category==='non-clinical';
  const catLabel={assessment:'הערכה תזונתית',followup:'מעקב חוזר',general:'כללי','non-clinical':'פעולות לא טיפוליות'}[r.category]||r.category;
  let html='<div class="modal-title">עריכת כלל</div>';
  html+='<div style="background:var(--accent-light);border-radius:10px;padding:8px 14px;font-size:13px;margin-bottom:16px">'+catLabel+'</div>';
  html+='<div class="form-group"><label>שם הפעילות</label><input type="text" id="er-name"></div>';
  html+='<div class="form-group"><label>סמל</label><input type="text" id="er-icon" maxlength="2"></div>';
  if(isNC){
    html+='<div style="background:var(--accent-light);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--primary);margin-bottom:12px">⏱ ניקוד אוטומטי: נקודה לכל 30 דקות</div>';
  } else {
    html+='<div class="form-group"><label>נקודות</label><input type="number" id="er-pts" min="0.5" step="0.5"></div>';
  }
  html+='<button class="btn btn-primary" id="er-save-btn">שמור שינויים</button>';
  openModal(html);
  document.getElementById('er-name').value=r.name;
  document.getElementById('er-icon').value=r.icon||'📋';
  if(!isNC)document.getElementById('er-pts').value=r.points;
  document.getElementById('er-save-btn').onclick=function(){saveEditRule(id);};
}
async function saveEditRule(id){
  const name=document.getElementById('er-name').value.trim();
  if(!name){showToast('נא למלא שם');return;}
  const icon=document.getElementById('er-icon').value.trim()||'📋';
  const upd={name,icon};
  const ptsEl=document.getElementById('er-pts');
  if(ptsEl){const pts=parseFloat(ptsEl.value);if(isNaN(pts)||pts<=0){showToast('נא למלא נקודות תקינות');return;}upd.points=pts;}
  try{
    await sbUpdate('rules',id,upd);
    const idx=_rules.findIndex(r=>r.id===id);
    if(idx>-1)Object.assign(_rules[idx],upd);
    closeModal();renderRulesList();
    if(document.getElementById('page-log').classList.contains('active'))initLogPage();
    showToast('הכלל עודכן!');
  }catch(e){showToast('שגיאה: '+e.message);}
}

// ═══ SETTINGS / USERS ═══
function renderAdminSettings(){renderAdminUserList();}
function renderAdminUserList(){
  const users=_users.filter(u=>u.id!==currentUser.id);
  const el=document.getElementById('admin-user-list');
  if(!users.length){el.innerHTML='<p class="text-muted">אין משתמשים נוספים.</p>';return;}
  el.innerHTML=users.map(u=>{
    const isAdmin=u.role==='admin';
    const sv=u.seniority||0;
    const scope=u.scope||100;
    const sLabel=isAdmin?'מנהל/ת':(sv<2?'0-2 שנות ותק':sv<4?'2-4 שנות ותק':'4+ שנות ותק');
    const scopeLabel=isAdmin?'':`  |  ${scope}% משרה`;
    const roleBadge=isAdmin?'<span style="background:#e8f4fd;color:#1565c0;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;margin-right:6px">מנהל</span>':'';
    return '<div class="nutri-row" style="cursor:default">'+
      '<div class="nutri-avatar">'+u.avatar+'</div>'+
      '<div class="nutri-info"><div class="nutri-name">'+roleBadge+u.name+'</div><div class="nutri-meta">'+sLabel+scopeLabel+'</div></div>'+
      '<div style="display:flex;gap:6px">'+
        '<button onclick="showEditUserModal(\''+u.id+'\')" style="background:var(--accent-light);border:none;border-radius:8px;padding:6px 10px;cursor:pointer">✏️</button>'+
        '<button onclick="removeUser(\''+u.id+'\')" style="background:var(--danger-light);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:var(--danger)">🗑</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
async function removeUser(id){
  if(!confirm('להסיר משתמש זה?'))return;
  try{
    await sbDelete('users',id);
    _users=_users.filter(u=>u.id!==id);
    renderAdminUserList();renderAdminOverview();showToast('המשתמש הוסר');
  }catch(e){showToast('שגיאה: '+e.message);}
}
function showEditUserModal(id){
  const u=_users.find(u=>u.id===id);if(!u)return;
  const isAdmin=u.role==='admin';
  let html=`<div class="modal-title">עריכת משתמש</div>
    <div class="form-group"><label>שם</label><input type="text" id="eu-name"></div>
    <div class="form-group"><label>תפקיד</label>
      <select id="eu-role" onchange="toggleEuFields()" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-family:Rubik,sans-serif;font-size:14px;background:var(--surface)">
        <option value="nutritionist">תזונאי/ת</option>
        <option value="admin">מנהל/ת</option>
      </select>
    </div>
    <div id="eu-nutri-fields">
      <div class="form-group"><label>ותק (שנים)</label><input type="number" id="eu-seniority" min="0" step="0.5"></div>
      <div class="form-group"><label>אחוזי משרה (%)</label><input type="number" id="eu-scope" min="1" max="100" step="1"></div>
    </div>
    <button class="btn btn-primary" id="eu-save-btn">שמור שינויים</button>`;
  openModal(html);
  document.getElementById('eu-name').value=u.name;
  document.getElementById('eu-role').value=u.role||'nutritionist';
  document.getElementById('eu-seniority').value=u.seniority||0;
  document.getElementById('eu-scope').value=u.scope||100;
  if(isAdmin)document.getElementById('eu-nutri-fields').style.display='none';
  document.getElementById('eu-save-btn').onclick=async function(){
    const name=document.getElementById('eu-name').value.trim();
    if(!name){showToast('נא למלא שם');return;}
    const role=document.getElementById('eu-role').value;
    const sen=role==='admin'?0:parseFloat(document.getElementById('eu-seniority').value)||0;
    const scope=role==='admin'?100:Math.min(100,Math.max(1,parseInt(document.getElementById('eu-scope').value)||100));
    const avatar=name.split(' ').map(w=>w[0]).join('').slice(0,2);
    try{
      await sbUpdate('users',id,{name,role,seniority:sen,scope,avatar});
      const idx=_users.findIndex(u=>u.id===id);
      if(idx>-1)Object.assign(_users[idx],{name,role,seniority:sen,scope,avatar});
      closeModal();
      renderAdminUserList();
      renderAdminOverview();
      showToast('✅ הפרטים עודכנו בהצלחה!');
    }catch(e){showToast('שגיאה: '+e.message);}
  };
}
function toggleEuFields(){
  const role=document.getElementById('eu-role')?.value;
  const fields=document.getElementById('eu-nutri-fields');
  if(fields)fields.style.display=role==='admin'?'none':'block';
}
function showAddUserModal(){
  openModal(`<div class="modal-title">הוסף משתמש</div>
    <div class="form-group"><label>שם מלא</label><input type="text" id="nu-name"></div>
    <div class="form-group"><label>אימייל</label><input type="email" id="nu-email"></div>
    <div class="form-group"><label>סיסמה זמנית</label><input type="text" id="nu-pass" placeholder="temp123"></div>
    <div class="form-group"><label>תפקיד</label>
      <select id="nu-role" onchange="toggleNuFields()" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-family:Rubik,sans-serif;font-size:14px;background:var(--surface)">
        <option value="nutritionist">תזונאי/ת</option>
        <option value="admin">מנהל/ת</option>
      </select>
    </div>
    <div id="nu-nutri-fields">
      <div class="form-group"><label>ותק (שנים)</label><input type="number" id="nu-seniority" value="0" min="0" step="0.5"></div>
      <div class="form-group"><label>אחוזי משרה (%)</label><input type="number" id="nu-scope" value="100" min="1" max="100" step="1"></div>
    </div>
    <button class="btn btn-primary" onclick="saveNewUser()">הוסף</button>`);
}
function toggleNuFields(){
  const role=document.getElementById('nu-role')?.value;
  const fields=document.getElementById('nu-nutri-fields');
  if(fields)fields.style.display=role==='admin'?'none':'block';
}
async function saveNewUser(){
  const name=document.getElementById('nu-name').value.trim();
  const email=document.getElementById('nu-email').value.trim().toLowerCase();
  const pass=document.getElementById('nu-pass').value;
  if(!name||!email||!pass){showToast('נא למלא את כל השדות');return;}
  const existing=_users.find(u=>u.email===email);
  if(existing){showToast('אימייל כבר קיים');return;}
  const role=document.getElementById('nu-role')?.value||'nutritionist';
  const sen=role==='admin'?0:parseFloat(document.getElementById('nu-seniority')?.value)||0;
  const scope=role==='admin'?100:Math.min(100,Math.max(1,parseInt(document.getElementById('nu-scope')?.value)||100));
  const avatar=name.split(' ').map(w=>w[0]).join('').slice(0,2);
  try{
    const u=await sbInsert('users',{id:'u'+Date.now(),name,email,password:pass,role,seniority:sen,scope,avatar});
    _users.push(u);
    closeModal();renderAdminUserList();renderAdminOverview();
    showToast(role==='admin'?'המנהל/ת נוסף/ה! ✅':'התזונאי/ת נוסף/ה! ✅');
  }catch(e){showToast('שגיאה: '+e.message);}
}
