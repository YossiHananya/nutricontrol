// ═══════════════════════════════════════════════════════
// utils.js — NutriControl
// Constants (MHE), formatting helpers (catHe, fmtPts, fmtDate, tmKey), salary calculators
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function catHe(cat){
  return {assessment:'הערכה תזונתית',followup:'מעקב חוזר',general:'כללי','non-clinical':'פעולות לא טיפוליות'}[cat]||cat||'';
}
function fmtPts(n){const v=parseFloat(n)||0;return v%1===0?v.toString():(Math.round(v*100)/100).toString();}
function fmtDate(d){if(!d)return'';const[y,m,dd]=d.split('-');return dd+'/'+m+'/'+y;}
function tmKey(){const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;}
function calcMonthlyTarget(year,month){
  let days=0,total=new Date(year,month+1,0).getDate();
  for(let d=1;d<=total;d++){const wd=new Date(year,month,d).getDay();if(wd>=0&&wd<=4)days++;}
  return days*14;
}
function getMaxPay(user){const s=user.seniority||0;return s<2?2050:s<4?2870:4100;}
function calcPay(user,pts,target){return Math.round(Math.min(1,target>0?pts/target:0)*getMaxPay(user));}



// DB initialised via Supabase (schema + seed in SQL file)

// ═══ AUTH ═══
