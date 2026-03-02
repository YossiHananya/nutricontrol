// ═══════════════════════════════════════════════════════
// profile.js — NutriControl
// Profile modal, change password, scoring info modal, working day calculator
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function showProfileModal(){
  const sv=currentUser.seniority||0;
  const sLabel=sv<2?'0-2 שנות ותק':sv<4?'2-4 שנות ותק':'4+ שנות ותק';
  openModal(`<div class="modal-title">הפרופיל שלי</div>
    <div style="text-align:center;margin-bottom:20px">
      <div style="width:72px;height:72px;background:var(--primary);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;margin:0 auto 12px">${currentUser.avatar}</div>
      <div style="font-weight:700;font-size:18px">${currentUser.name}</div>
      <div style="color:var(--text-muted);font-size:13px">${currentUser.email}</div>
      ${currentUser.role==='nutritionist'?`<div style="margin-top:6px;background:var(--accent-light);border-radius:8px;padding:4px 12px;font-size:12px;color:var(--primary);display:inline-block">${sLabel}</div>`:''}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:16px;margin-bottom:16px">
      <div class="card-title">🔒 שינוי סיסמה</div>
      <div class="form-group"><label>סיסמה נוכחית</label><input type="password" id="pw-current" placeholder="סיסמה נוכחית"></div>
      <div class="form-group"><label>סיסמה חדשה</label><input type="password" id="pw-new" placeholder="לפחות 6 תווים"></div>
      <div class="form-group"><label>אישור סיסמה</label><input type="password" id="pw-confirm" placeholder="הזן שוב"></div>
      <button class="btn btn-primary" onclick="changePassword()" style="margin-bottom:12px">שמור סיסמה</button>
    </div>
    <button class="btn btn-secondary" onclick="doLogout()">התנתק/י</button>`);
}
async function changePassword(){
  const cur=document.getElementById('pw-current')?.value;
  const nw=document.getElementById('pw-new')?.value;
  const conf=document.getElementById('pw-confirm')?.value;
  if(!cur||!nw||!conf){showToast('נא למלא את כל השדות');return;}
  if(cur!==currentUser.password){showToast('סיסמה נוכחית שגויה');return;}
  if(nw.length<6){showToast('סיסמה חדשה – לפחות 6 תווים');return;}
  if(nw!==conf){showToast('הסיסמאות אינן תואמות');return;}
  try{
    await sbUpdate('users',currentUser.id,{password:nw});
    currentUser.password=nw;
    // Update in _users cache
    const idx=_users.findIndex(u=>u.id===currentUser.id);
    if(idx>-1)_users[idx].password=nw;
    closeModal();showToast('✅ הסיסמה שונתה בהצלחה!');
  }catch(e){showToast('שגיאה: '+e.message);}
}

// ═══ SCORING INFO ═══
function calcMonthDays(y,mo){
  let d=0,t=new Date(y,mo+1,0).getDate();
  for(let i=1;i<=t;i++){const w=new Date(y,mo,i).getDay();if(w>=0&&w<=4)d++;}
  return d;
}
function showScoringInfo(){
  const now=new Date();
  const target=calcMonthlyTarget(now.getFullYear(),now.getMonth());
  const days=calcMonthDays(now.getFullYear(),now.getMonth());
  const rows=[{label:'0-2 שנות ותק',max:2050},{label:'2-4 שנות ותק',max:2870},{label:'4+ שנות ותק',max:4100}];
  let html='<div class="modal-title">📊 מודל הניקוד</div>';
  html+='<div style="background:var(--accent-light);border-radius:12px;padding:14px;margin-bottom:16px">';
  html+='<div style="font-weight:700;margin-bottom:6px">עקרון הניקוד</div>';
  html+='<div style="font-size:13px;line-height:1.8">כל יום עבודה (א\'–ה\') = <b>14 נקודות</b><br>חודש זה: <b>'+target+' נקודות</b> ('+days+' ימי עבודה)</div>';
  html+='</div>';
  html+='<div style="font-weight:700;margin-bottom:8px">סוגי פעילות</div>';
  html+='<div style="font-size:13px;margin-bottom:16px;line-height:2.2">';
  html+='📊 <b>הערכה תזונתית</b> — נקודות קבועות לפי כלל<br>';
  html+='🔄 <b>מעקב חוזר</b> — נקודות קבועות לפי כלל<br>';
  html+='📋 <b>כללי</b> — נקודות קבועות לפי כלל<br>';
  html+='⏱ <b>פעולות לא טיפוליות</b> — <b>נקודה לכל 30 דקות</b> (דיוק לדקה)';
  html+='</div>';
  html+='<div style="font-weight:700;margin-bottom:8px">טבלת שכר לפי ותק</div>';
  html+='<div style="border-radius:12px;overflow:hidden;border:1.5px solid var(--border)">';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:var(--primary);color:#fff;padding:8px 12px;font-size:12px;font-weight:700"><span>ותק</span><span style="text-align:center">מקסימום</span><span style="text-align:left">ערך נקודה</span></div>';
  rows.forEach(r=>{
    const ptVal=(r.max/target).toFixed(2);
    html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;padding:10px 12px;font-size:13px;border-top:1px solid var(--border)">';
    html+='<span>'+r.label+'</span><span style="text-align:center;font-weight:600;color:var(--primary)">₪'+r.max+'</span><span style="text-align:left;color:var(--text-muted)">₪'+ptVal+'</span></div>';
  });
  html+='</div>';
  html+='<p style="font-size:11px;color:var(--text-muted);margin-top:12px;text-align:center">השכר מחושב יחסית להשגת יעד הנקודות החודשי</p>';
  openModal(html);
}

// ═══ EXCEL EXPORT ═══
