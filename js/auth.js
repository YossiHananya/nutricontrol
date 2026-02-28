// ═══════════════════════════════════════════════════════
// auth.js — NutriControl
// Login, register, logout, launchApp — all authentication flows
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function showAuthTab(tab,btn){
  document.querySelectorAll('.auth-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('login-form').classList.toggle('hidden',tab!=='login');
  document.getElementById('register-form').classList.toggle('hidden',tab!=='register');
}
async function doLogin(){
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pass=document.getElementById('login-pass').value;
  if(!email||!pass){showToast('נא למלא אימייל וסיסמה');return;}
  showLoading(true);
  try{
    const users=await sbWhere('users','email',email);
    const user=users.find(u=>u.password===pass);
    if(!user){showToast('אימייל או סיסמה שגויים');return;}
    currentUser={...user,pointsType:user.points_type};
    SESSION.set(user.id);
    await loadCache();
    document.getElementById('auth-screen').style.display='none';
    launchApp();
  }catch(e){showToast('שגיאת חיבור: '+e.message);}
  finally{showLoading(false);}
}
async function doRegister(){
  const name=document.getElementById('reg-name').value.trim();
  const email=document.getElementById('reg-email').value.trim().toLowerCase();
  const pass=document.getElementById('reg-pass').value;
  if(!name||!email||!pass){showToast('נא למלא את כל השדות');return;}
  showLoading(true);
  try{
    const existing=await sbWhere('users','email',email);
    if(existing.length){showToast('אימייל כבר קיים');return;}
    const avatar=name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const newUser=await sbInsert('users',{
      id:'u'+Date.now(),name,email,password:pass,
      role:'nutritionist',seniority:0,avatar
    });
    currentUser=newUser;
    SESSION.set(newUser.id);
    await loadCache();
    document.getElementById('auth-screen').style.display='none';
    launchApp();
  }catch(e){showToast('שגיאה בהרשמה: '+e.message);}
  finally{showLoading(false);}
}
function doLogout(){
  currentUser=null;_users=[];_rules=[];_logs=[];
  SESSION.clear();
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  closeModal();
}
function launchApp(){
  document.getElementById('app').style.display='flex';
  histCurrentMonth=tmKey();
  if(currentUser.role==='admin'){
    document.getElementById('nutri-pages').classList.add('hidden');
    document.getElementById('admin-pages').classList.remove('hidden');
    adminCurrentMonth=tmKey();
    renderAdmin();
  } else {
    document.getElementById('admin-pages').classList.add('hidden');
    document.getElementById('nutri-pages').classList.remove('hidden');
    renderDashboard();
  }
}

// ═══ DATE SELECTS ═══
