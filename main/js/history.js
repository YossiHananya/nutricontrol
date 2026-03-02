// ═══════════════════════════════════════════════════════
// history.js — NutriControl
// History page: renderHistory, month scroller, filters, applyHistFilters
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function renderHistory(selectedMonth){
  if(selectedMonth)histCurrentMonth=selectedMonth;
  if(!histCurrentMonth)histCurrentMonth=tmKey();
  buildMonthScroller('month-scroller',histCurrentMonth,'selectHistMonth');
  applyHistFilters();
}
function selectHistMonth(key){
  histCurrentMonth=key;
  buildMonthScroller('month-scroller',key,'selectHistMonth');
  applyHistFilters();
}
function applyHistFilters(){
  const monthKey=histCurrentMonth||tmKey();
  const catFilter=document.getElementById('hist-cat-filter')?.value||'';
  const sortMode=document.getElementById('hist-sort')?.value||'date-desc';
  const allMonthLogs=getMyLogs().filter(l=>l.date.startsWith(monthKey));
  let logs=[...allMonthLogs];
  if(catFilter)logs=logs.filter(l=>getRuleById(l.ruleId).category===catFilter);
  logs.sort((a,b)=>{
    if(sortMode==='date-asc')return a.date.localeCompare(b.date);
    if(sortMode==='pts-desc')return parseFloat(b.points)-parseFloat(a.points);
    if(sortMode==='pts-asc')return parseFloat(a.points)-parseFloat(b.points);
    return b.date.localeCompare(a.date);
  });
  const totalPts=allMonthLogs.reduce((s,l)=>s+parseFloat(l.points||0),0);
  const [y,mo]=monthKey.split('-').map(Number);
  const target=calcMonthlyTarget(y,mo-1);
  const pct=Math.min(100,Math.round(totalPts/target*100));
  const maxPay=getMaxPay(currentUser);
  const pay=Math.round(Math.min(1,target>0?totalPts/target:0)*maxPay);
  const ptVal=target>0?(maxPay/target).toFixed(2):0;
  document.getElementById('history-stats').innerHTML=
    '<div class="card" style="padding:14px 18px">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
      '<span style="font-size:13px;color:var(--text-muted)">'+allMonthLogs.length+' פעילויות | ערך נקודה: ₪'+ptVal+'</span>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">'+
      '<span style="font-family:\'DM Serif Display\',serif;font-size:28px;color:var(--primary)">'+fmtPts(totalPts)+' נק.</span>'+
      '<span style="font-size:15px;font-weight:600;color:var(--primary)">₪'+pay+'</span>'+
    '</div>'+
    '<div class="progress-bar-wrap" style="background:var(--border)"><div class="progress-bar-fill" style="width:'+pct+'%"></div></div>'+
    '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">'+pct+'% מיעד '+target+' נק.</div>'+
    '</div>';
  renderMonthTrend(getMyLogs(),'hist-trend-bars');
  document.getElementById('history-list').innerHTML=logs.length?
    '<div class="card" style="padding:8px 20px">'+logs.map(l=>activityHTML(l,true)).join('')+'</div>':
    '<p class="text-muted">אין פעילויות'+(catFilter?' בסוג זה':'')+' בחודש זה.</p>';
}

// ═══ ADMIN ═══
let adminCurrentMonth=null;
