// ═══════════════════════════════════════════════════════
// db.js — NutriControl
// Supabase client, cache helpers (sbAll/sbWhere/sbInsert/sbUpdate/sbDelete), loadCache
// ═══════════════════════════════════════════════════════
/* global currentUser, histCurrentMonth, adminCurrentMonth,
          _users, _rules, _logs, supa, SESSION, MHE,
          XLSX, supabase */
'use strict';

// ═══ SUPABASE CLIENT ═══
const SUPA_URL='https://msnqpxadpudrtxiikvhd.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbnFweGFkcHVkcnR4aWlrdmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTg2MTQsImV4cCI6MjA4Nzc5NDYxNH0.Twtt-sEFrzdAH_KdyvYYtLORM5god9BrBkkUCrlJndQ';
let supa;
try{ supa=supabase.createClient(SUPA_URL,SUPA_KEY); }
catch(e){ console.error('Supabase init failed',e); }

// ── In-memory cache (loaded fresh on every login) ──────────────────
let _users=[];
let _rules=[];
let _logs=[];

// ── Generic helpers ────────────────────────────────────────────────
async function sbAll(table){
  const{data,error}=await supa.from(table).select('*');
  if(error)throw error;
  return data||[];
}
async function sbWhere(table,col,val){
  const{data,error}=await supa.from(table).select('*').eq(col,val);
  if(error)throw error;
  return data||[];
}
async function sbInsert(table,obj){
  const{data,error}=await supa.from(table).insert(obj).select().single();
  if(error)throw error;
  return data;
}
async function sbUpdate(table,id,obj){
  const{error}=await supa.from(table).update(obj).eq('id',id);
  if(error)throw error;
}
async function sbDelete(table,id){
  const{error}=await supa.from(table).delete().eq('id',id);
  if(error)throw error;
}

// ── Cache accessors (sync) ─────────────────────────────────────────
function getRuleById(id){return _rules.find(r=>r.id===id)||{name:'?',icon:'📋',category:'',points:0,points_type:'fixed'};}
function getMyLogs(){return [..._logs].sort((a,b)=>b.date.localeCompare(a.date));}

// ── Load all data into cache after login ───────────────────────────
async function loadCache(){
  showLoading(true);
  try{
    [_rules,_users]=await Promise.all([sbAll('rules'),sbAll('users')]);
    _logs=currentUser.role==='admin'
      ? await sbAll('logs')
      : await sbWhere('logs','user_id',currentUser.id);
    // Normalise field names (supabase snake_case → camelCase used in UI)
    _logs=_logs.map(l=>({...l,userId:l.user_id,ruleId:l.rule_id,pointsType:l.points_type,createdAt:new Date(l.created_at).getTime()}));
    _rules=_rules.map(r=>({...r,pointsType:r.points_type}));
  }catch(e){
    showToast('שגיאה בטעינת נתונים: '+e.message);
    console.error(e);
  }finally{
    showLoading(false);
  }
}

// ── Session (localStorage for session token only) ──────────────────
const SESSION={
  get(){try{return JSON.parse(localStorage.getItem('nc_session'));}catch{return null;}},
  set(v){localStorage.setItem('nc_session',JSON.stringify(v));},
  clear(){localStorage.removeItem('nc_session');}
};


// ═══ CONSTANTS ═══
const MHE=['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const SHE={approved:'מאושר',pending:'ממתין',flagged:'מסומן'};
let currentUser=null;
let logState={category:null,selectedRuleId:null,nonClinicalRuleId:null};
