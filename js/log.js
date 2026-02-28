// ═══════════════════════════════════════════════════════
// log.js — NutriControl
// Activity log page: date picker, category selection, points calculation, submitLog
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function initDateSelects(){
  const now=new Date();
  const el=document.getElementById('log-date');
  if(!el)return;
  el.value=now.toISOString().split('T')[0];
  updateDateDisplay();
}
function updateLogDate(){updateDateDisplay();}
function openDatePicker(){
  const el=document.getElementById('log-date');
  if(!el)return;
  // showPicker() is the modern API; fallback: make input briefly visible and click it
  if(el.showPicker){
    try{el.showPicker();return;}catch(e){}
  }
  // Fallback: temporarily make input visible at button position, click, then re-hide
  const disp=document.querySelector('.date-il-display');
  const rect=disp?disp.getBoundingClientRect():{top:200,left:10,width:300,height:42};
  el.style.cssText=`position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;opacity:0;z-index:9999;pointer-events:auto`;
  el.focus();el.click();
  setTimeout(()=>{el.style.cssText='position:absolute;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';},300);
}

function updateDateDisplay(){
  const el=document.getElementById('log-date');
  const disp=document.getElementById('log-date-display');
  if(!el||!disp)return;
  if(!el.value){disp.textContent='בחר תאריך';return;}
  const[y,m,d]=el.value.split('-');
  disp.textContent=d+'.'+m+'.'+y;
}

// ═══ MONTH SCROLLER ═══
function buildMonthScroller(scrollerId,currentKey,onClickFn){
  const wrap=document.getElementById(scrollerId);
  if(!wrap)return;
  const now=new Date();
  let html='';
  for(let i=12;i>=-3;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const isFuture=i<0,isCur=i===0;
    const target=calcMonthlyTarget(d.getFullYear(),d.getMonth());
    const label=MHE[d.getMonth()]+"'"+(String(d.getFullYear()).slice(2));
    const active=key===currentKey?' active':'';
    const futureClass=isFuture?' future':'';
    html+=`<button class="month-pill${active}${futureClass}" onclick="${onClickFn}('${key}')">
      <span class="mp-month">${label}${isCur?' ●':''}</span>
      <span class="mp-target">יעד: ${target}</span>
    </button>`;
  }
  wrap.innerHTML=html;
  const activeBtn=wrap.querySelector('.month-pill.active');
  if(activeBtn)setTimeout(()=>activeBtn.scrollIntoView({inline:'center',behavior:'smooth'}),50);
}

// ═══ DASHBOARD ═══
