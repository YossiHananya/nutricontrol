// ═══════════════════════════════════════════════════════
// ui.js — NutriControl
// Navigation (showPage, showAdminNav), modals, toast notifications, app init (DOMContentLoaded)
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

// ═══ NAV ═══
function showPage(name,btn){
  document.querySelectorAll('#nutri-pages .page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('#nav-nutritionist .nav-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(name==='dashboard')renderDashboard();
  else if(name==='history')renderHistory();
  else if(name==='log')initLogPage();
}
function openModal(html){document.getElementById('modal-body').innerHTML=html;document.getElementById('modal-overlay').classList.remove('hidden');}
function closeModal(e){if(!e||e.target===document.getElementById('modal-overlay'))document.getElementById('modal-overlay').classList.add('hidden');}
function showLoading(on){
  let el=document.getElementById('loading-overlay');
  if(!el){
    el=document.createElement('div');
    el.id='loading-overlay';
    el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:center;justify-content:center';
    el.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px 32px;font-family:Rubik,sans-serif;font-size:15px;color:#0a3d2e;font-weight:600">⏳ טוען...</div>';
    document.body.appendChild(el);
  }
  el.style.display=on?'flex':'none';
}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded',async function(){
  const savedId=SESSION.get();
  if(savedId){
    showLoading(true);
    try{
      const users=await sbWhere('users','id',savedId);
      if(users.length){
        currentUser=users[0];
        await loadCache();
        document.getElementById('auth-screen').style.display='none';
        launchApp();
        return;
      }
    }catch(e){console.warn('Auto-login failed',e);}
    finally{showLoading(false);}
  }
  // No valid session — show auth screen (already visible by default)
});
