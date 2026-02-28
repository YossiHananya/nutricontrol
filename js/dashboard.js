// ═══════════════════════════════════════════════════════
// dashboard.js — NutriControl
// Home page: renderDashboard, trend charts (daily & monthly), gauge/progress display
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

function drawGauge(pct){
  // Semi-circle arc from 180° to 0° (left to right)
  // Center: 110,110  Radius: 75
  const cx=110,cy=110,r=75;
  const startAngle=Math.PI;   // 180° = left
  const endAngle=0;            // 0°   = right
  const totalArc=Math.PI;      // 180°

  function polar(angle){
    return [cx+r*Math.cos(angle), cy+r*Math.sin(angle)];
  }

  // Background arc (full semi-circle)
  const [bx1,by1]=polar(startAngle);
  const [bx2,by2]=polar(endAngle);
  const bgPath=`M ${bx1} ${by1} A ${r} ${r} 0 0 1 ${bx2} ${by2}`;

  // Fill arc (0..pct)
  const fillAngle=startAngle - (Math.min(pct,100)/100)*totalArc;
  const [fx2,fy2]=polar(fillAngle);
  const largeArc=Math.min(pct,100)>=50?1:0;
  const fillPath=pct>0?`M ${bx1} ${by1} A ${r} ${r} 0 ${largeArc} 1 ${fx2} ${fy2}`:'';

  const bgEl=document.getElementById('gauge-bg');
  const fillEl=document.getElementById('gauge-fill');
  const needleEl=document.getElementById('gauge-needle');
  const pctEl=document.getElementById('gauge-pct');
  const ptsEl=document.getElementById('gauge-pts');
  const maxLbl=document.getElementById('gauge-max-label');
  if(!bgEl)return;

  bgEl.setAttribute('d',bgPath);
  if(fillEl){
    fillEl.setAttribute('d',fillPath||bgPath);
    // Color gradient: red→yellow→green
    const col=pct>=100?'#4ade80':pct>=70?'#fbbf24':pct>=40?'#fb923c':'#f87171';
    fillEl.setAttribute('stroke',pct>0?col:'transparent');
  }

  // Needle rotation: -180° (left) to 0° (right)
  if(needleEl){
    const deg=-180+(Math.min(pct,100)/100)*180;
    needleEl.style.transform=`rotate(${deg}deg)`;
  }
}

function renderDashboard(){
  const now=new Date(),h=now.getHours();
  document.getElementById('dash-greeting').textContent=(h<12?'בוקר טוב':h<17?'צהריים טובים':'ערב טוב')+' 👋';
  document.getElementById('dash-name').textContent=currentUser.name;
  document.getElementById('dash-month').textContent=MHE[now.getMonth()]+' '+now.getFullYear();
  const target=calcMonthlyTarget(now.getFullYear(),now.getMonth());
  document.getElementById('dash-target').textContent='/ '+target+' נקודות';
  document.getElementById('dash-month-label').textContent=MHE[now.getMonth()]+' '+now.getFullYear();
  const logs=getMyLogs(),tm=tmKey();
  const ml=logs.filter(l=>l.date.startsWith(tm));
  const pts=ml.reduce((s,l)=>s+parseFloat(l.points||0),0);
  const pct=Math.min(100,Math.round(pts/target*100));
  document.getElementById('dash-pts').textContent=fmtPts(pts);
  document.getElementById('dash-progress').style.width=pct+'%';
  document.getElementById('dash-progress-label').textContent=pct+'% מהיעד החודשי ('+target+' נק.)';
  document.getElementById('dash-total-logs').textContent=ml.length;
  const pctEl=document.getElementById('dash-pct-display');
  if(pctEl){
    pctEl.textContent=pct+'%';
    pctEl.style.color=pct>=100?'var(--success)':pct>=70?'var(--accent)':'var(--primary)';
  }
  const pay=calcPay(currentUser,pts,target),maxPay=getMaxPay(currentUser);
  const ptVal=target>0?(maxPay/target).toFixed(2):0;
  const payEl=document.getElementById('dash-pay');
  if(payEl)payEl.innerHTML='<span style="font-family:\'DM Serif Display\',serif;font-size:26px">₪'+pay+'</span> <span style="opacity:.7;font-size:14px">/ ₪'+maxPay+'</span><div style="font-size:12px;opacity:.6;margin-top:2px">ערך נקודה: ₪'+ptVal+'</div>';
  renderTrend(logs);
  const recent=[...logs].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  document.getElementById('recent-activity-list').innerHTML=recent.length?recent.map(l=>activityHTML(l,false)).join(''):'<p class="text-muted">אין פעילויות עדיין.</p>';
}

function renderTrend(logs){
  // Show work days of the CURRENT WEEK (Sun–Thu), current month context
  const now=new Date();
  const todayDow=now.getDay(); // 0=Sun..6=Sat
  // Find Sunday of current week
  const weekStart=new Date(now);
  weekStart.setDate(now.getDate()-todayDow);

  const days=[];
  for(let d=0;d<5;d++){  // Sun–Thu only
    const date=new Date(weekStart);
    date.setDate(weekStart.getDate()+d);
    const key=date.toISOString().split('T')[0];
    const pts=logs.filter(l=>l.date===key).reduce((s,l)=>s+parseFloat(l.points||0),0);
    const isToday=d===todayDow;
    const isFuture=date>now;
    days.push({date,key,pts,dayNum:date.getDate(),isToday,isFuture,dow:d});
  }

  const CHART_H=68;
  const dailyTarget=14; // daily point target
  const max=Math.max(...days.map(d=>d.pts),dailyTarget,1);
  const weekTotal=days.reduce((s,d)=>s+d.pts,0);
  const el=document.getElementById('trend-bars');
  if(!el)return;

  const lbl=document.getElementById('trend-total-label');
  if(lbl)lbl.textContent='סה"כ השבוע: '+fmtPts(weekTotal)+' נק.';

  el.innerHTML=days.map((d)=>{
    const barH=d.pts>0?Math.max(4,Math.round(d.pts/max*CHART_H)):0;
    const targetH=Math.round(dailyTarget/max*CHART_H);
    const pct=d.pts>=dailyTarget;
    const color=d.isFuture?'var(--border)':d.isToday?'#fff':pct?'rgba(255,255,255,.85)':'rgba(255,255,255,.5)';
    const textColor=d.isFuture?'rgba(255,255,255,.3)':d.isToday?'#fff':'rgba(255,255,255,.7)';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;height:${CHART_H+28}px">
      <!-- daily target line -->
      <div style="position:absolute;bottom:${20+targetH}px;left:0;right:0;border-top:1px dashed rgba(255,255,255,.35)"></div>
      <!-- pts label above bar -->
      ${d.pts>0?`<div style="position:absolute;bottom:${20+barH+3}px;font-size:9px;font-weight:700;color:${color};left:0;right:0;text-align:center">${fmtPts(d.pts)}</div>`:''}
      <!-- bar -->
      <div style="position:absolute;bottom:20px;left:4px;right:4px;height:${barH}px;background:${color};border-radius:3px 3px 0 0;transition:height .5s ease"></div>
      <!-- baseline -->
      <div style="position:absolute;bottom:18px;left:0;right:0;border-top:1px solid rgba(255,255,255,.2)"></div>
      <!-- day number -->
      <div style="position:absolute;bottom:5px;font-size:11px;font-weight:${d.isToday?700:400};color:${textColor}">${d.dayNum}</div>
      <!-- today dot -->
      ${d.isToday?`<div style="position:absolute;bottom:1px;width:4px;height:4px;border-radius:50%;background:#fff;left:50%;transform:translateX(-50%)"></div>`:''}
    </div>`;
  }).join('');
}

function renderMonthTrend(logs, containerId){
  // History page shows last 6 months (monthly resolution)
  const now=new Date();
  const months=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const target=calcMonthlyTarget(d.getFullYear(),d.getMonth());
    const pts=logs.filter(l=>l.date.startsWith(key)).reduce((s,l)=>s+parseFloat(l.points||0),0);
    months.push({label:MHE[d.getMonth()].slice(0,3),pts,target,cur:i===0});
  }
  const CHART_H=60;
  const max=Math.max(...months.map(m=>Math.max(m.pts,m.target)),1);
  const el=document.getElementById(containerId);
  if(!el)return;
  el.innerHTML=months.map(m=>{
    const barH=Math.max(3,Math.round(m.pts/max*CHART_H));
    const targetY=Math.round(m.target/max*CHART_H);
    const pct=m.target>0?Math.round(m.pts/m.target*100):0;
    const color=m.cur?'var(--primary)':pct>=100?'var(--success)':pct>=70?'var(--accent)':'var(--border)';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;height:${CHART_H+20}px">
      <div style="position:absolute;bottom:${20+targetY}px;left:1px;right:1px;border-top:1.5px dashed var(--accent);opacity:.7"></div>
      ${m.pts>0?`<div style="position:absolute;bottom:${20+barH+2}px;font-size:9px;font-weight:600;color:${color};left:0;right:0;text-align:center">${Math.round(m.pts)}</div>`:''}
      <div style="position:absolute;bottom:20px;left:3px;right:3px;height:${barH}px;background:${color};border-radius:4px 4px 0 0"></div>
      <div style="position:absolute;bottom:4px;font-size:10px;color:var(--text-muted);font-weight:${m.cur?700:400}">${m.label}</div>
    </div>`;
  }).join('');
}

function activityHTML(log, showDelete){
  const rule=getRuleById(log.ruleId);
  const delBtn=showDelete?'<button onclick="deleteLog(\''+log.id+'\')" style="background:none;border:none;color:var(--danger);font-size:18px;cursor:pointer;padding:4px;line-height:1" title="מחק">🗑</button>':'';
  return '<div class="activity-item">'+
    '<div class="activity-icon">'+(rule.icon||'📋')+'</div>'+
    '<div class="activity-info">'+
      '<div class="activity-title">'+(rule.name||'פעילות')+'</div>'+
      '<div class="activity-meta">'+fmtDate(log.date)+' · '+catHe(rule.category)+'</div>'+
    '</div>'+
    '<div style="display:flex;align-items:center;gap:6px">'+
      '<div class="activity-points">+'+fmtPts(log.points)+'</div>'+
      delBtn+
    '</div>'+
  '</div>';
}

async function deleteLog(id){
  if(!confirm('למחוק רשומה זו?'))return;
  try{
    await sbDelete('logs',id);
    _logs=_logs.filter(l=>l.id!==id);
    renderHistory();renderDashboard();showToast('הרשומה נמחקה');
  }catch(e){showToast('שגיאה במחיקה: '+e.message);}
}

// ═══ LOG PAGE ═══
function initLogPage(){
  logState={category:null,selectedRuleId:null,nonClinicalRuleId:null};
  document.querySelectorAll('#cat-pills .pill').forEach(p=>p.classList.remove('active'));
  document.getElementById('sub-pill-list').innerHTML='';
  document.getElementById('non-clinical-list').innerHTML='';
  document.getElementById('timed-group').classList.add('hidden');
  document.getElementById('timed-duration').value='';
  document.getElementById('log-notes').value='';
  document.getElementById('points-display').textContent='0';
  initDateSelects();
}

function selectCategory(btn,cat){
  logState.category=cat;logState.selectedRuleId=null;logState.nonClinicalRuleId=null;
  document.querySelectorAll('#cat-pills .pill').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  const rules=_rules.filter(r=>r.category===cat);
  if(cat==='non-clinical'){
    document.getElementById('sub-pill-list').innerHTML='';
    document.getElementById('timed-group').classList.remove('hidden');
    renderNonClinicalList(rules);
  } else {
    document.getElementById('non-clinical-list').innerHTML='';
    document.getElementById('timed-group').classList.add('hidden');
    renderSubList(rules);
  }
  calcPoints();
}
function renderSubList(rules){
  const el=document.getElementById('sub-pill-list');
  el.innerHTML=rules.map(r=>'<button class="sub-pill" onclick="pickSubRule(this,\''+r.id+'\')">'+r.icon+' '+r.name+'</button>').join('');
}
function renderNonClinicalList(rules){
  const el=document.getElementById('non-clinical-list');
  el.innerHTML=rules.map(r=>'<button class="sub-pill" onclick="pickNCRule(this,\''+r.id+'\')">'+r.icon+' '+r.name+'</button>').join('');
}
function pickSubRule(btn,id){
  document.querySelectorAll('#sub-pill-list .sub-pill').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');logState.selectedRuleId=id;calcPoints();
}
function pickNCRule(btn,id){
  document.querySelectorAll('#non-clinical-list .sub-pill').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');logState.nonClinicalRuleId=id;calcPoints();
}
function calcPoints(){
  let pts=0;
  if(logState.category==='non-clinical'){
    const r=_rules.find(r=>r.id===logState.nonClinicalRuleId);
    const m=parseFloat(document.getElementById('timed-duration')?.value)||0;
    if(r&&m>0)pts=Math.round((m/30)*r.points*100)/100;
  } else {
    const r=_rules.find(r=>r.id===logState.selectedRuleId);
    pts=r?r.points:0;
  }
  document.getElementById('points-display').textContent=fmtPts(pts);
  return pts;
}
async function submitLog(){
  const pts=calcPoints();
  const date=document.getElementById('log-date').value;
  if(!date){showToast('נא לבחור תאריך');return;}
  if(pts<=0){showToast('לא חושבו נקודות – בדוק בחירה/זמן');return;}
  const ruleId=logState.category==='non-clinical'?logState.nonClinicalRuleId:logState.selectedRuleId;
  if(!ruleId){showToast('נא לבחור פעילות');return;}
  showLoading(true);
  try{
    const newLog=await sbInsert('logs',{
      id:'l'+Date.now(),
      user_id:currentUser.id,
      rule_id:ruleId,
      points:pts,
      date,
      notes:document.getElementById('log-notes').value.trim(),
      status:'approved'
    });
    // Add to cache with normalised fields
    _logs.push({...newLog,userId:newLog.user_id,ruleId:newLog.rule_id,createdAt:Date.now()});
    showToast('✅ הפעילות נרשמה! +'+fmtPts(pts)+' נקודות');
    initLogPage();renderDashboard();
  }catch(e){showToast('שגיאה בשמירה: '+e.message);}
  finally{showLoading(false);}
}

// ═══ HISTORY ═══
let histCurrentMonth=null;
