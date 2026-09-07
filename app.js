// 打工人仪表盘 · 前端原型 v0.1
const STORE = 'dqrd_v1';
const DEFAULT = {
  user: { name: 'OO', city: '成都' },
  profile: {
    workStart:'09:00', workEnd:'18:00', lunchStart:'12:00', lunchEnd:'13:00',
    salary:13500, otW:1.5, otWe:2,
    hireDate:'2022-07-01', bonus:50000, bonusAmort:false, retireAge:50,
    unpunchedMode:'standard', // 未打卡处理：standard=按默认作息, off=视为当天没上班
  },
  payday: { type:'next_month', day:15, rule:'advance', amount:13500 },
  pension: { paid:8.25, personal:51200, wage:8321, idx:1.0, rate:4, age:50 },
  fire: { target:1000000, spend:40000, save:6000, rate:5 },
  invest: { target:6, benchmark:'csi300', benchMonthly:[-2.1,2.3,0.5,-1.0,1.4,0.9,-1.8,2.0,1.1,-0.4,1.6,0.7], base:156000 },
  // 周记录：2026 年第 36 周 (9/1-9/7) 起，1-35周空，36-39周有数据；周累计百分比
  weekly: [],
  monthly: [
    {y:'2026-01',r:-1.2},{y:'2026-02',r:3.4},{y:'2026-03',r:0.8},{y:'2026-04',r:-0.6},
    {y:'2026-05',r:2.1},{y:'2026-06',r:1.5},{y:'2026-07',r:-2.3},{y:'2026-08',r:3.0},
    {y:'2026-09',r:2.14},
  ],
  yearly: { '2025': { cum: 4.8 }, '2026': null },
  // 每天打卡：{ 'YYYY-MM-DD': {in:'09:12', out:'19:30', leave:0, note:''} }
  punches: {},
  // 法定节假日 / 调休：{ 'YYYY-MM-DD': 1 放假, 2 调休上班 }
  holidays: {},
  accounts: {
    deposits:[{n:'招商银行活期',b:42300,rate:1.5},{n:'货币基金',b:80000,rate:1.8}],
    invest:[{n:'股票/基金组合',b:156000}],
    funds:[{n:'公积金账户',b:68400}],
    social:[{n:'养老个人账户',b:51200}],
    debts:[{n:'房贷',b:25420,rate:3.1,month:4200,remain:168}],
  },
  trend: buildDemoTrend(),
};

function buildDemoTrend(){
  // 12 个月净资产近似线性 + 一些波动
  const arr=[]; let v=290000;
  for(let i=11;i>=0;i--){
    v += 4000 + Math.sin(i)*3000 + Math.random()*2000;
    arr.push({ym:`2026-${String(((9-i)%12+12)%12+1).padStart(2,'0')}`,v:Math.round(v)});
  }
  return arr;
}

let S = load();
function load(){
  try{
    const v = JSON.parse(localStorage.getItem(STORE));
    if(v) return Object.assign({}, DEFAULT, v, { profile: Object.assign({}, DEFAULT.profile, v.profile||{}) , pension: Object.assign({}, DEFAULT.pension, v.pension||{}) , fire: Object.assign({}, DEFAULT.fire, v.fire||{}) , invest: Object.assign({}, DEFAULT.invest, v.invest||{}), payday: Object.assign({}, DEFAULT.payday, v.payday||{}), accounts: Object.assign({}, DEFAULT.accounts, v.accounts||{}), trend: v.trend||DEFAULT.trend, weekly: v.weekly||[], monthly: v.monthly||[], yearly: v.yearly||{}, punches: v.punches||{}, holidays: v.holidays||{}});
  }catch(e){}
  return JSON.parse(JSON.stringify(DEFAULT));
}
function save(){ localStorage.setItem(STORE, JSON.stringify(S)); }
function fmt(n,d=2){ if(!isFinite(n)) return '—'; return '¥'+Math.round(n).toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtN(n,d=0){ if(!isFinite(n)) return '—'; return n.toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d})}
function pad2(n){return n<10?'0'+n:''+n}
function pad(n,w=2){return String(n).padStart(w,'0')}
function todayKey(d){ const x = d||new Date(); return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`; }
// 应用的「今天」固定为演示日期；未打卡模式以此为历史 / 未来分界
function appToday(){ return new Date('2026-09-07T00:00:00'); }

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); }

// ====================== 路由 ======================
const ROUTES = ['today','history','assets','pension','fire','invest','settings'];
function route(){
  const h = location.hash.replace('#','') || 'today';
  if(!ROUTES.includes(h)) return;
  $$('.view').forEach(v=>v.classList.add('hidden'));
  $('#view-'+h).classList.remove('hidden');
  $$('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.route===h));
  renderTabBar(h);
  document.title = ({today:'今日',history:'历史',assets:'资产',pension:'养老',fire:'FIRE',invest:'理财能力',settings:'设置'})[h] + ' · 打工人仪表盘';
  $('#pageTitle').textContent = ({today:'今日',history:'历史',assets:'资产',pension:'养老',fire:'FIRE',invest:'理财能力',settings:'设置'})[h];
  render();
  // 切回 today 时重启 tick
  if(h==='today') startTick();
}
window.addEventListener('hashchange', route);

// ====================== 渲染分发 ======================
function render(){
  const h = location.hash.replace('#','') || 'today';
  ({today:renderToday, history:renderHistory, assets:renderAssets, pension:renderPension, fire:renderFire, invest:renderInvest, settings:renderSettings})[h]();
}

// ====================== 今日 ======================
let tickId = null;
function startTick(){ stopTick(); tickId = setInterval(renderToday, 1000); }
function stopTick(){ if(tickId) clearInterval(tickId); tickId=null; }

function parseHM(s){ const [h,m]=s.split(':').map(Number); return h*60+m; }

// ---------- 计薪天数：按当月工作日自动算 ----------
// 节假日表：1=放假（不算工作日），2=调休上班（周末也算工作日）
function ymdKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function isWorkday(d){
  const flag = (S.holidays||{})[ymdKey(d)];
  if(flag===1) return false;
  if(flag===2) return true;
  const w = d.getDay();
  return w!==0 && w!==6;
}
// 某月的工作日（计薪天数）
function workdaysInMonth(y, m){ // m: 0-11
  let n=0; const d=new Date(y,m,1);
  while(d.getMonth()===m){ if(isWorkday(d)) n++; d.setDate(d.getDate()+1); }
  return n;
}
// 当期计薪天数（默认取今天所在月）
function payDays(d){
  const x = d || new Date();
  return workdaysInMonth(x.getFullYear(), x.getMonth());
}
// 当月截至 d 已过的工作日
function workdaysPassed(d){
  const y=d.getFullYear(), m=d.getMonth();
  let n=0;
  for(let day=1; day<=d.getDate(); day++) if(isWorkday(new Date(y,m,day))) n++;
  return n;
}
// 实际计薪月薪（年终奖可选摊入）
function monthlyPay(){
  const p=S.profile;
  return p.salary + (p.bonusAmort ? (p.bonus||0)/12 : 0);
}
// 日薪 = 税后月薪 ÷ 当月计薪天数
function dailyPay(d){ return monthlyPay() / payDays(d); }
// 节假日表 ⇄ 设置页文本
function holidaysToText(){
  const h = S.holidays||{};
  return Object.keys(h).sort().map(k=> h[k]===2 ? k+'*' : k).join(',');
}
function textToHolidays(txt){
  const out={}; const y = new Date().getFullYear();
  String(txt||'').split(/[,，\s]+/).forEach(raw=>{
    let s = raw.trim(); if(!s) return;
    let flag = 1;
    if(s.endsWith('*')){ flag = 2; s = s.slice(0,-1); }
    let key = null;
    if(/^\d{1,2}-\d{1,2}$/.test(s)) key = y+'-'+s.split('-').map(x=>x.padStart(2,'0')).join('-');
    else if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){ const [a,b,c]=s.split('-'); key = a+'-'+b.padStart(2,'0')+'-'+c.padStart(2,'0'); }
    if(key) out[key] = flag;
  });
  return out;
}
function renderToday(){
  const p = S.profile;
  const ws=parseHM(p.workStart), we=parseHM(p.workEnd), ls=parseHM(p.lunchStart), le=parseHM(p.lunchEnd);
  const workMins = (we-ws)-(le-ls);
  const daily = dailyPay(); // 今日应得 = 税后月薪 ÷ 当月计薪天数
  const now = new Date();
  const nowM = now.getHours()*60 + now.getMinutes();
  // 已工作分钟
  let worked = 0;
  if(nowM > ws){
    if(nowM <= ls) worked = nowM - ws;
    else if(nowM <= le) worked = (ls - ws);
    else worked = (nowM - le) + (ls - ws);
    worked = Math.min(worked, workMins);
  }
  const pct = worked / workMins;
  const earned = daily * pct;
  const remaining = daily - earned;
  const rate = dailyPay() / ((workMins)/60);

  $('#td-money').textContent = fmt(earned);
  $('#td-rate').textContent = rate.toFixed(1);
  $('#td-target').textContent = fmtN(daily,0);
  $('#td-rest').textContent = fmt(remaining);
  $('#td-rest-pct').textContent = ((remaining/daily)*100).toFixed(0)+'%';

  // 阶段
  let stage='尚未开始';
  if(nowM >= ws && nowM < ls) stage='上午工作中';
  else if(nowM >= ls && nowM < le) stage='午休中（薪资暂停跳动）';
  else if(nowM >= le && nowM < we) stage='下午工作中';
  else if(nowM >= we) stage='已下班，加班可登记';
  $('#td-stage').textContent = stage;

  // 进度条
  const barW = $('#view-today').getBoundingClientRect().width || 600;
  const total = we - ws;
  const lunchLeft = (ls - ws) / total * 100;
  const lunchW = (le - ls) / total * 100;
  $('#td-lunch').style.left = lunchLeft+'%';
  $('#td-lunch').style.width = lunchW+'%';
  $('#td-fill').style.width = (pct*100).toFixed(2)+'%';
  $('#td-fill').style.background = nowM>we?'var(--amber)':'var(--up)';
  $('#td-pct').textContent = (pct*100).toFixed(1)+'%';
  $('#td-axis').innerHTML = `<span>${p.workStart}</span><span>午休 ${p.lunchStart}-${p.lunchEnd}</span><span>${p.workEnd}</span>`;

  // 下班倒计时
  if(nowM < ws){
    const m=ws-nowM;
    const h=Math.floor(m/60), mm=m%60;
    $('#td-left-lbl').textContent = '距上班还有';
    $('#td-left').textContent = (h>0?h+' 时 ':'')+mm+' 分';
  }
  else if(nowM >= ws && nowM < we){
    $('#td-left-lbl').textContent = '还有多久下班';
    let leftM = we - nowM;
    if(nowM >= ls && nowM < le) leftM = we - nowM;
    if(nowM >= le) leftM = we - nowM;
    const h=Math.floor(leftM/60), m=leftM%60;
    $('#td-left').textContent = (h>0?h+' 小时 ':'')+m+' 分';
  } else {
    $('#td-left-lbl').textContent = '今日已收工';
    $('#td-left').textContent = '已下班';
  }

  // 本周 / 本月
  const dow = (now.getDay()+6)%7; // 周一=0
  const weekDone = Math.min(dow+1, 5);
  const dayOfMonth = now.getDate();
  const monthDone = workdaysPassed(now);   // 本月已过工作日
  const monthTotal = payDays(now);         // 本月计薪天数（自动）
  $('#td-week').textContent = weekDone;
  $('#td-month').textContent = fmtN(daily * monthDone);
  $('#td-mtd').textContent = `本月计薪 ${monthTotal} 天 · 已过 ${monthDone} 天`;
  // 假期（极简：下一个 1 号或法定节假日占位）
  $('#td-holiday').textContent = '24 天';

  // 今日打卡
  const tp = $('#td-punch');
  if(tp){
    const rec = S.punches[todayKey(now)];
    if(rec && rec.leave) tp.innerHTML = '今日 <span class="tag purple">请假</span> 不计时长';
    else if(rec && punchHours(rec)!=null){
      const i = punchInfo(rec);
      tp.innerHTML = `今日打卡 <b style="color:var(--text)">${rec.in}–${rec.out}</b> · 在司 ${i.h.toFixed(1)}h`
        + (i.ot>0.02?` · <span style="color:var(--up)">加班 ${fmtDur(i.ot)}</span>`:'')
        + (i.late>0?` · <span style="color:var(--amber)">迟到 ${i.late} 分</span>`:'');
    } else tp.textContent = '今日未打卡';
  }

  // 发工资倒计时
  const pay = computePayday(now);
  const totalD = Math.round((pay.next - pay.last)/86400000);
  const passD = Math.max(0, Math.round((now - pay.last)/86400000));
  const ppct = Math.max(0,Math.min(1, passD/totalD));
  $('#td-pdays').textContent = pay.daysLeft+' 天';
  $('#td-pdate').textContent = (pay.next.getMonth()+1)+'月'+pay.next.getDate()+'日';
  $('#td-pay-amt').textContent = fmtN(S.payday.amount);
  $('#td-pay-pct').textContent = (ppct*100).toFixed(0)+'%';
  $('#td-pay-fill').style.width = (ppct*100).toFixed(1)+'%';
  $('#td-pay-pass').textContent = passD;
  $('#td-pay-total').textContent = totalD;
  $('#td-pay-earned').textContent = fmt(S.payday.amount*ppct);

  // 里程碑
  const ms = [
    { p:.25, label:'今天赚到了 25%', reach: pct>=.25 },
    { p:.5, label:'今天赚到了 50%（半天白送）', reach: pct>=.5 },
    { p:.75, label:'今天赚到了 75%', reach: pct>=.75 },
    { p:1, label:'今天赚到了 100%', reach: pct>=1 },
  ];
  $('#td-milestones').innerHTML = ms.map(m=>`<div class="list-item"><div class="name" style="text-decoration:${m.reach?'line-through':'none'};color:${m.reach?'var(--text-3)':'var(--text)'}">${m.label}</div><div class="meta">${m.reach?'<span class="tag up">已达成</span>':'<span class="tag">'+(m.p*100)+'%</span>'}</div></div>`).join('');
}

function computePayday(now){
  const {type, day, rule} = S.payday;
  // 发薪日 = 类型决定的那个月
  let y=now.getFullYear(), m=now.getMonth();
  let payMonth; // 实际到账的月份
  if(type==='current_month') payMonth = m;
  else payMonth = m+1; // 次月发上月
  let next = new Date(y, payMonth, Math.min(day, 28), 10, 0, 0);
  if(next <= now) next = new Date(y, payMonth+1, Math.min(day, 28), 10, 0, 0);
  // 周末节假日处理
  if(rule==='advance'){
    while([0,6].includes(next.getDay()) /* 不含节假日表 */){
      next = new Date(next.getTime() - 86400000);
    }
  } else if(rule==='delay'){
    while([0,6].includes(next.getDay())) next = new Date(next.getTime()+86400000);
  }
  const last = new Date(next.getFullYear(), next.getMonth()-1, Math.min(day,28), 10,0,0);
  const daysLeft = Math.ceil((next - now)/86400000);
  return {next, last, daysLeft};
}

// ====================== 历史 ======================
function renderMonths(box, year, start, cols){
  box.innerHTML='';
  box.style.gridTemplateColumns = `repeat(${cols},12px)`;
  for(let m=0;m<12;m++){
    const md = new Date(year, m, 1);
    const col = Math.floor((md - start)/86400000/7);
    if(col<0 || col>=cols) continue;
    const s = document.createElement('span');
    s.style.gridColumn = (col+1);
    s.textContent = (m+1)+'月';
    box.appendChild(s);
  }
}
function renderHistory(){
  const hire = new Date(S.profile.hireDate+'T00:00:00');
  const today = appToday();
  const days = Math.max(0, Math.floor((today-hire)/86400000));
  $('#hi-days').textContent = days;
  $('#hi-earn').textContent = fmt(S.profile.salary * (days/365*12));
  $('#hi-company').textContent = days;
  $('#hi-leave').textContent = '12.5';

  // 年份下拉
  const hireY = hire.getFullYear();
  const years=[]; for(let y=hireY;y<=today.getFullYear();y++) years.push(y);
  const ysel=$('#hi-year');
  ysel.innerHTML = years.map(y=>`<option value="${y}">${y} 年</option>`).join('');
  if(!(HI_YEAR && years.includes(HI_YEAR))) HI_YEAR = today.getFullYear();
  ysel.value = HI_YEAR;
  const Y = HI_YEAR;

  // 收入热力图：当年，按周对齐（周一起列，GitHub 风格）
  const heat = $('#hi-heat');
  heat.innerHTML='';
  const start = weekStart(new Date(Y,0,1));
  const yEnd = new Date(Y,11,31); yEnd.setHours(0,0,0,0);
  const totalCells = Math.floor((yEnd - start)/86400000)+1;
  const cols = Math.max(1, Math.ceil(totalCells/7));
  heat.style.gridTemplateColumns = `repeat(${cols},12px)`;

  // 月份分隔线：落在该列的每个月第一天
  const monthCols = new Set();
  for(let m=0;m<12;m++){
    const md = new Date(Y,m,1);
    const col = Math.floor((md - start)/86400000/7);
    if(col>=0 && col<cols) monthCols.add(col);
  }
  const monthStartAdded = new Set();

  for(let i=0;i<cols*7;i++){
    const d = new Date(start.getTime() + i*86400000);
    const c = document.createElement('div');
    c.className='d';
    const col = i/7|0;
    if(d.getFullYear()!==Y || d>today){
      c.classList.add('future');
      c.title = d.getFullYear()!==Y ? '' : '未来';
      heat.appendChild(c); continue;
    }
    if(monthCols.has(col) && !monthStartAdded.has(col)){
      c.classList.add('month-start');
      monthStartAdded.add(col);
    }
    c.title = todayKey(d);
    const dow = d.getDay();
    if(dow===0||dow===6){ c.classList.add('holiday'); }
    else {
      const seed = ((d.getTime()/86400000)%7);
      const l = (Math.sin(seed)+1)/2 * 4 | 0;
      if(l>0) c.classList.add('l'+(l>4?4:l));
      else c.classList.add('past-empty');
    }
    heat.appendChild(c);
  }

  renderMonths($('#hi-months'), Y, start, cols);
  renderAttendance();
}

// ---------- 考勤：上班时长热力图 ----------
let HI_YEAR = null;
let AT_YEAR = null;
function hmStr(mins){ const m=Math.max(0,Math.min(24*60,Math.round(mins))); return pad(Math.floor(m/60))+':'+pad(m%60); }
function weekStart(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function stdMinutes(){
  const p=S.profile;
  return (parseHM(p.workEnd)-parseHM(p.workStart)) - (parseHM(p.lunchEnd)-parseHM(p.lunchStart));
}
// 未打卡的工作日是否视为「当天没上班」
// 仅对「今天及之后」的未打卡日期生效；今天之前的历史日期始终按默认作息（保持历史不变）
function unpunchedAsOff(d){
  const p = S.profile;
  if(p.unpunchedMode !== 'off') return false;
  return d >= appToday();
}
// 在司时长（小时，已扣午休）
// rec: 打卡记录；d: 日期。传 d 时，未打卡的工作日按当前模式计（热力图用）
function punchHours(rec, d){
  const p=S.profile;
  if(rec && rec.leave) return null;
  if(!rec || !rec.in || !rec.out){
    if(!d || !isWorkday(d)) return null;
    if(unpunchedAsOff(d)) return null; // 模式：视为当天没上班
    return stdMinutes()/60;            // 模式：默认按规定上下班
  }
  const i=parseHM(rec.in), o=parseHM(rec.out);
  if(!(o>i)) return null;
  const ls=parseHM(p.lunchStart), le=parseHM(p.lunchEnd);
  const lunch=Math.max(0, Math.min(o,le)-Math.max(i,ls));
  return (o-i-lunch)/60;
}
function punchInfo(rec, d){
  const h=punchHours(rec, d); if(h==null) return null;
  const p=S.profile, std=stdMinutes()/60;
  const real = !!(rec && rec.in && rec.out && !rec.leave);
  // 无容差：晚于规定上班时间即迟到，早于规定下班时间即早退
  const lateRaw = real ? parseHM(rec.in)-parseHM(p.workStart) : 0;
  const earlyRaw = real ? parseHM(p.workEnd)-parseHM(rec.out) : 0;
  return {
    h, std, real,
    late: Math.max(0, lateRaw),
    early: Math.max(0, earlyRaw),
    ot: Math.max(0, h-std),
  };
}
function fmtDur(h){ if(!isFinite(h)) return '—'; const H=Math.floor(h), M=Math.round((h-H)*60); return (H>0?H+' 小时 ':'')+M+' 分'; }

function renderAttendance(){
  const p=S.profile, std=stdMinutes()/60;
  const today=appToday();
  $('#at-std').textContent = std.toFixed(1).replace(/\.0$/,'');
  $('#at-start').textContent = p.workStart;

  // 年份下拉
  const hireY = new Date(S.profile.hireDate).getFullYear(); // eslint-disable-line
  const years=[]; for(let y=hireY;y<=today.getFullYear();y++) years.push(y);
  const ysel=$('#at-year');
  ysel.innerHTML = years.map(y=>`<option value="${y}">${y} 年</option>`).join('');
  if(!(AT_YEAR && years.includes(AT_YEAR))) AT_YEAR = today.getFullYear();
  ysel.value = AT_YEAR;
  const Y = AT_YEAR;

  // 当年统计：真实打卡 + 未打卡工作日（默认按规定作息）
  const y0 = new Date(Y,0,1), y1 = new Date(Y,11,31);
  const end = today < y1 ? today : y1;
  const recs = [];
  for(let dt = new Date(y0); dt <= end; dt = new Date(dt.getTime()+86400000)){
    const k = todayKey(dt);
    const r = S.punches[k];
    const i = punchInfo(r, dt);
    if(i) recs.push({k, r:r||{}, i});
  }
  const realRecs = recs.filter(x=>x.i.real);
  const defCount = recs.length - realRecs.length;
  $('#at-count').textContent = realRecs.length;
  if(recs.length){
    const avg = recs.reduce((s,x)=>s+x.i.h,0)/recs.length;
    const ot = recs.reduce((s,x)=>s+x.i.ot,0);
    const late = recs.filter(x=>x.i.late>0).length;
    $('#at-avg').textContent = avg.toFixed(1);
    $('#at-ot').textContent = Math.round(ot*10)/10;
    $('#at-ot-day').textContent = (ot/std).toFixed(1);
    $('#at-late').textContent = late;
    if(realRecs.length){
      const last = realRecs.reduce((a,x)=> parseHM(x.r.out)>parseHM(a.r.out)?x:a, realRecs[0]);
      $('#at-latest').textContent = last.r.out;
      $('#at-latest-d').textContent = last.k + ' · 在司 ' + last.i.h.toFixed(1) + ' 小时';
    } else {
      $('#at-latest').textContent='—';
      $('#at-latest-d').textContent='暂无真实打卡记录';
    }
    const modeTxt = p.unpunchedMode==='off'
      ? '未打卡按「当天没上班」处理（仅今天及之后生效，历史保持默认作息）'
      : `未打卡的工作日默认按 ${p.workStart}–${p.workEnd} 计`;
    $('#at-caption').textContent = `颜色深浅 = 在司时长（已扣午休）· ${modeTxt}`
      + (defCount ? ` · 含 ${defCount} 天默认，点格子补录真实打卡` : ' · 点格子可补录 / 修改');
  } else {
    ['#at-avg','#at-ot','#at-ot-day','#at-late'].forEach(s=>$(s).textContent='—');
    $('#at-latest').textContent='—'; $('#at-latest-d').textContent='暂无打卡记录';
    $('#at-caption').textContent = '还没有打卡记录 —— 点「记录今日打卡」开始，或「生成示例」先看看效果';
  }

  // 热力图
  const grid=$('#at-heat'); grid.innerHTML='';
  const yStart = weekStart(new Date(Y,0,1));
  const yEnd = new Date(Y,11,31); yEnd.setHours(0,0,0,0);
  const cells = Math.floor((yEnd-yStart)/86400000)+1;
  const cols = Math.max(1, Math.ceil(cells/7));
  grid.style.gridTemplateColumns = `repeat(${cols},12px)`;

  // 月份分隔线
  const monthCols = new Set();
  for(let m=0;m<12;m++){
    const md = new Date(Y,m,1);
    const col = Math.floor((md - yStart)/86400000/7);
    if(col>=0 && col<cols) monthCols.add(col);
  }
  const monthStartAdded = new Set();

  const wk=['一','二','三','四','五','六','日'];
  for(let i=0;i<cols*7;i++){
    const d = new Date(yStart.getTime()+i*86400000);
    const c = document.createElement('div'); c.className='d';
    const col = i/7|0;
    if(d.getFullYear()!==Y || d>today){
      c.classList.add('future');
      c.title = d.getFullYear()!==Y ? '' : '未来';
      grid.appendChild(c); continue;
    }
    if(monthCols.has(col) && !monthStartAdded.has(col)){
      c.classList.add('month-start');
      monthStartAdded.add(col);
    }
    const key = todayKey(d);
    const rec = S.punches[key];
    const isDefault = !rec || rec.leave===0 && !rec.in && !rec.out; // 无打卡记录
    const h = punchHours(rec, d);
    if(h==null){
      if(rec&&rec.leave){
        c.classList.add('leave');
        c.title = key + ' · 请假';
      } else if(isWorkday(d)){
        c.classList.add('past-empty');
        c.title = key + ' · 未打卡，按设定视为没上班';
      } else {
        c.classList.add('past-empty');
        c.title = key + ' · 休息日';
      }
    } else {
      const l = h<std-1?1 : h<std?2 : h<std+1?3 : h<std+2?4 : 5;
      c.classList.add('l'+l);
      if(isDefault){
        c.classList.add('default');
        c.title = `${key} 周${wk[(d.getDay()+6)%7]} · 未打卡，默认 ${p.workStart}–${p.workEnd} · 在司 ${h.toFixed(1)} 小时`;
      } else {
        c.title = `${key} 周${wk[(d.getDay()+6)%7]} · ${rec.in}–${rec.out} · 在司 ${h.toFixed(1)} 小时` + (rec.note?` · ${rec.note}`:'');
      }
    }
    c.onclick = ()=>openPunch(key);
    grid.appendChild(c);
  }

  renderMonths($('#at-months'), Y, yStart, cols);
}

let _pk = null;
function openPunch(key){
  _pk = key;
  const bg=$('#modalBg'); bg.classList.remove('hidden');
  const body=$('#modalBody');
  const rec = S.punches[key] || {};
  const d = new Date(key+'T00:00:00');
  const wkx=['日','一','二','三','四','五','六'];
  body.innerHTML = `<h3>打卡 · ${key} 周${wkx[d.getDay()]}</h3>
    <div class="field"><div class="row" style="gap:10px">
      <div style="flex:1"><label>上班打卡</label><input type="time" id="pc-in" value="${rec.in||S.profile.workStart}"></div>
      <div style="flex:1"><label>下班打卡</label><input type="time" id="pc-out-time" value="${rec.out||S.profile.workEnd}"></div>
    </div></div>
    <div class="field"><label class="row" style="gap:8px;align-items:center;margin:0"><input type="checkbox" id="pc-leave" style="width:auto" ${rec.leave?'checked':''}> 请假 / 休息（不计时长）</label></div>
    <div class="field"><label>备注</label><input type="text" id="pc-note" value="${(rec.note||'').replace(/"/g,'&quot;')}" placeholder="例：版本上线临时加班"></div>
    <p class="muted" style="font-size:13px;line-height:1.7" id="pc-preview"></p>
    <div class="modal-actions">
      ${S.punches[key]?'<button class="ghost" onclick="delPunch()">删除</button>':''}
      <button onclick="closeSheet()">取消</button>
      <button class="primary" onclick="savePunch()">保存</button>
    </div>`;
  const up = ()=>{ const el=$('#pc-preview'); if(el) el.innerHTML = punchPreview(); };
  ['pc-in','pc-out-time','pc-leave'].forEach(id=>{ const el=$('#'+id); if(el) el.addEventListener(id==='pc-leave'?'change':'input', up); });
  up();
}
function punchPreview(){
  const rec={in:$('#pc-in').value, out:$('#pc-out-time').value, leave:$('#pc-leave').checked?1:0};
  if(rec.leave) return '当天标记为请假，不计入时长与加班统计。';
  if(!rec.in||!rec.out) return '填上班 / 下班打卡时间后自动计算（午休已自动扣除）。';
  const info=punchInfo(rec);
  if(!info) return '<span style="color:var(--up)">下班时间需晚于上班时间</span>';
  const p=S.profile;
  const rate = dailyPay()/info.std;
  const bits=[`在司 <b>${info.h.toFixed(1)}</b> 小时（规定 ${info.std.toFixed(1)}）`];
  if(info.ot>0.02) bits.push(`<span style="color:var(--up)">加班 ${fmtDur(info.ot)}</span>`);
  if(info.late>0) bits.push(`<span style="color:var(--amber)">迟到 ${info.late} 分钟</span>`);
  if(info.early>0) bits.push(`<span style="color:var(--down)">早退 ${fmtDur(info.early)}</span>`);
  bits.push(`这天值 <b>${fmt(info.h*rate)}</b>`);
  return bits.join(' · ');
}
function savePunch(){
  const rec={in:$('#pc-in').value, out:$('#pc-out-time').value, leave:$('#pc-leave').checked?1:0, note:$('#pc-note').value};
  if(!rec.leave && (!rec.in||!rec.out)){ toast('请填写打卡时间，或勾选请假'); return; }
  S.punches[_pk]=rec; save(); closeSheet(); render(); toast('打卡已保存');
}
function delPunch(){
  delete S.punches[_pk]; save(); closeSheet(); render(); toast('已删除该日打卡');
}
function genDemoPunch(){
  const p=S.profile, ws=parseHM(p.workStart), we=parseHM(p.workEnd);
  const today=appToday();
  let n=0;
  for(let y=today.getFullYear()-1;y<=today.getFullYear();y++){
    for(let m=0;m<12;m++){
      const dim=new Date(y,m+1,0).getDate();
      for(let dd=1;dd<=dim;dd++){
        const d=new Date(y,m,dd); if(d>today) continue;
        const dow=d.getDay();
        if(dow===0||dow===6){ if(Math.random()>0.12) continue; }
        else if(Math.random()<0.04){ S.punches[todayKey(d)]={in:'',out:'',leave:1,note:'休假'}; n++; continue; }
        const din  = ws - 12 + Math.floor(Math.random()*45);
        const dout = we - 30 + Math.floor(Math.random()*175);
        S.punches[todayKey(d)]={in:hmStr(din), out:hmStr(dout), leave:0, note:''};
        n++;
      }
    }
  }
  save(); render(); toast(`已生成 ${n} 天示例打卡`);
}
function clearPunch(){
  if(!confirm('确定清空全部打卡记录？此操作不可撤销。')) return;
  S.punches={}; save(); render(); toast('打卡记录已清空');
}

// ====================== 资产 ======================
function renderAssets(){
  const acc = S.accounts;
  const assets = [...acc.deposits, ...acc.invest, ...acc.funds, ...acc.social].reduce((s,a)=>s+(+a.b||0),0);
  const debt = acc.debts.reduce((s,a)=>s+(+a.b||0),0);
  const net = assets - debt;
  $('#as-net').textContent = fmtN(net,0);
  $('#as-net-month').textContent = '↑ 较上月 +¥6,120';
  $('#as-assets').textContent = fmtN(assets,0);
  $('#as-liab').textContent = fmtN(debt,0);

  // 列表
  const all = [
    ...acc.deposits.map(a=>({...a, type:'存款'})), ...acc.invest.map(a=>({...a, type:'投资'})),
    ...acc.funds.map(a=>({...a, type:'公积金'})), ...acc.social.map(a=>({...a, type:'社保'}))
  ];
  $('#as-asset-list').innerHTML = all.map(a=>`<div class="list-item"><div><div class="name">${a.n}</div><div class="meta" style="text-align:left">${a.type}${a.rate?` · ${a.rate}%`:''}</div></div><div class="meta">${fmtN(a.b,0)}</div></div>`).join('') || '<div class="empty-state">暂无资产</div>';
  $('#as-debt-list').innerHTML = acc.debts.map(a=>`<div class="list-item"><div><div class="name">${a.n}</div><div class="meta" style="text-align:left">${a.rate}% · 月供 ¥${fmtN(a.month)} · 剩 ${a.remain} 期</div></div><div class="meta">-¥${fmtN(a.b)}</div></div>`).join('') || '<div class="empty-state">无负债，自由</div>';

  drawAssetTrend();
}

function drawAssetTrend(){
  const data = S.trend.slice(-12);
  const W=680, H=200, x0=44, x1=W-20, yT=24, yB=H-30;
  const max = Math.max(...data.map(d=>d.v)), min = Math.min(...data.map(d=>d.v));
  const padR = (max-min)*0.15 || 1000;
  const lo = min - padR, hi = max + padR;
  function X(i){ return x0 + (x1-x0)*i/(data.length-1) }
  function Y(v){ return yT + (hi-v)/(hi-lo)*(yB-yT) }
  const pts = data.map((d,i)=>`${X(i)},${Y(d.v)}`).join(' ');
  const area = data.map((d,i)=>`${X(i)},${Y(d.v)}`).join(' ')+` ${X(data.length-1)},${yB} ${X(0)},${yB}`;
  const grid = [lo,(lo+hi)/2,hi].map(v=>`<line x1="${x0}" y1="${Y(v)}" x2="${x1}" y2="${Y(v)}" stroke="var(--border-2)" stroke-width=".5"/><text x="${x0-6}" y="${Y(v)+4}" text-anchor="end" font-size="11" fill="var(--text-3)">${(v/10000).toFixed(1)}w</text>`).join('');
  const labels = data.map((d,i)=>i%2===0?`<text x="${X(i)}" y="${yB+16}" text-anchor="middle" font-size="11" fill="var(--text-3)">${d.ym.slice(5)}月</text>`:'').join('');
  $('#as-trend').innerHTML = `<defs><linearGradient id="netgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--brand)" stop-opacity=".18"/><stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="${area}" fill="url(#netgrad)"/><polyline points="${pts}" fill="none" stroke="var(--brand)" stroke-width="2.5"/><circle cx="${X(data.length-1)}" cy="${Y(data[data.length-1].v)}" r="4" fill="var(--brand)"/>${labels}`;
}

// ====================== 养老 ======================
function renderPension(){
  const pn = S.pension;
  const monthsPaid = Math.round(pn.paid*12);
  const remainMin = Math.max(0, 15*12 - monthsPaid);
  const now = new Date();
  const age = (now - new Date(S.profile.hireDate))/365.25/86400000 + 22; // 简化
  const yearsToRetire = Math.max(0, pn.age - age);
  $('#pn-paid').textContent = pn.paid.toFixed(2);
  $('#pn-min').textContent = (remainMin/12).toFixed(2);
  $('#pn-ret').textContent = yearsToRetire.toFixed(1);
  $('#pn-bar').style.width = Math.min(100, pn.paid/15*100)+'%';
  $('#pn-pers').textContent = fmtN(pn.personal);
  $('#pn-month').textContent = fmtN(S.profile.salary*0.08); // 简化 8%
  $('#pn-rate').textContent = pn.rate;
  $('#pn-age').textContent = pn.age;

  const retireAgeMap = {50:195,55:170,60:139,65:101,63:117};
  const accountMonths = retireAgeMap[pn.age] || 139;
  const indexedWage = pn.wage * pn.idx;
  const basePension = (pn.wage + indexedWage)/2 * pn.paid * 0.01;
  const personalPension = pn.personal / accountMonths;
  const est = basePension + personalPension;
  $('#pn-est').textContent = fmt(est,0);
  $('#pn-base').textContent = fmtN(basePension,0);
  $('#pn-pers-pay').textContent = fmtN(personalPension,0);

  // 目标反推
  const tgt = +$('#pn-target').value;
  $('#pn-target-v').textContent = fmtN(tgt,0);
  // 反推逻辑（极简）：在已缴基础上，要达到目标退休金 → 需要基础养老金 = tgt - personalPension_current ≈ tgt - personalPension
  // 简化：保持个人账户不变，调整缴费年限 base = (tgt - personalPension)*2/(wage*(1+idx)) (按公式反推)，年限 = base
  // 个人账户需：x/accountMonths = tgt - basePension → x = (tgt-basePension)*accountMonths
  // 月缴存需达到：(x - 当前 personal)/剩余月数
  const needBasic = Math.max(0, tgt - personalPension);
  const needYears = (needBasic * 2) / (pn.wage * (1 + pn.idx));
  const needPers = Math.max(0, (tgt - basePension) * accountMonths);
  const remainMonths = Math.max(1, Math.round(yearsToRetire*12));
  const needMonthly = Math.max(0, (needPers - pn.personal)/remainMonths);
  $('#pn-tg-paid').textContent = needYears.toFixed(1);
  $('#pn-tg-pers').textContent = fmtN(needPers);
  $('#pn-tg-month').textContent = fmtN(needMonthly);
}

// ====================== FIRE ======================
let curFireRate = 5;
function renderFire(){
  const f = S.fire;
  const target = f.target;
  const assets = S.accounts.deposits.concat(S.accounts.invest).reduce((s,a)=>s+a.b,0);
  const net = assets;
  const pct = Math.min(1, net/target);
  const ring = $('#fr-ring');
  const C = 2*Math.PI*48;
  ring.setAttribute('stroke-dasharray', C);
  ring.setAttribute('stroke-dashoffset', C*(1-pct));
  $('#fr-pct').textContent = (pct*100).toFixed(1)+'%';
  $('#fr-target').textContent = fmtN(target,0);
  $('#fr-spend').textContent = fmtN(f.spend,0);
  $('#fr-gap').textContent = fmtN(target-net,0);
  $('#fr-save').textContent = fmtN(f.save,0);
  $('#fr-rate').textContent = curFireRate+'%';
  $('#fr-save2').textContent = fmtN(f.save,0);
  $('#fr-target-v').textContent = fmtN(+$('#fr-target-slider').value,0);
  $('#fr-spend-v').textContent = fmtN(+$('#fr-spend-slider').value,0);

  // 达成预测
  const i = curFireRate/100/12;
  const need = target - net;
  let months = 0;
  if(i>0) months = Math.ceil(Math.log(1 + need*i/f.save) / Math.log(1+i));
  else months = Math.ceil(need/f.save);
  const yr = new Date().getFullYear() + Math.floor(months/12);
  const mo = (new Date().getMonth()+1 + months%12) % 12 || 12;
  $('#fr-when').textContent = yr+' 年 '+mo+' 月';

  drawFireCurve();
  drawFireLink();
}

function drawFireCurve(){
  const target = +$('#fr-target-slider').value || S.fire.target;
  const save = S.fire.save;
  const W=680, H=220, x0=44, x1=W-20, yT=24, yB=H-30;
  const totalMonths = 12*30; // 30 年
  const series = [3,5,8].map(r=>{
    const i=r/100/12;
    const arr=[]; let v=0;
    for(let m=1;m<=totalMonths;m++){ v = v*(1+i) + save; arr.push(v); }
    return {r, arr};
  });
  const maxV = Math.max(target, ...series.map(s=>s.arr[s.arr.length-1]));
  function X(m){ return x0 + (x1-x0)*m/totalMonths }
  function Y(v){ return yT + (1 - v/maxV)*(yB-yT) }
  const targetLine = `<line x1="${x0}" y1="${Y(target)}" x2="${x1}" y2="${Y(target)}" class="dotline"/><text x="${x1}" y="${Y(target)-6}" text-anchor="end" font-size="11" fill="var(--text-3)">目标 ${fmtN(target,0)}</text>`;
  const lines = series.map(s=>{
    const reachIdx = s.arr.findIndex(v=>v>=target);
    const pts = s.arr.map((v,m)=>`${X(m)},${Y(v)}`).join(' ');
    const color = s.r===curFireRate?'var(--brand)':'var(--surface-2)';
    const w = s.r===curFireRate?3:1.5;
    const label = `<text x="${x0+8}" y="${Y(s.arr[Math.min(s.arr.length-1, totalMonths/2)])+8}" font-size="11" fill="${color}" font-weight="${s.r===curFireRate?500:400}">${s.r}%</text>`;
    const dot = reachIdx>0?`<circle cx="${X(reachIdx)}" cy="${Y(target)}" r="4" fill="${color}"/>`:'';
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${w}"/>${dot}${label}`;
  }).join('');
  const yT2 = [0,.25,.5,.75,1].map(t=>`<line x1="${x0}" y1="${yT+t*(yB-yT)}" x2="${x1}" y2="${yT+t*(yB-yT)}" stroke="var(--border-2)" stroke-width=".5"/>`).join('');
  const xLabs = [0,5,10,15,20,25,30].map(y=>`<text x="${X(y*12)}" y="${yB+16}" text-anchor="middle" font-size="11" fill="var(--text-3)">${y}年</text>`).join('');
  $('#fr-curve').innerHTML = yT2 + targetLine + lines + xLabs;
}

function drawFireLink(){
  const spend = +$('#fr-spend-slider').value;
  const my = +$('#fr-my-rate').value;
  const list = [3, my, 5, 8].map(r=>({r, p: spend/(r/100)}));
  const i = list.findIndex(x=>x.r===my);
  const next = i<list.length-1?list[i+1].r:8;
  const diff = list[i].p - list[i+1].p;
  const months = Math.round(diff / S.fire.save);
  $('#fr-my-rate-v').textContent = my.toFixed(1)+'%';
  $('#fr-link-out').innerHTML = `当前 <b style="color:var(--brand-2)">${my.toFixed(1)}%</b> → 需本金 <b>${fmtN(list[i].p)}</b>；提到 <b>${next}%</b> → 需本金 <b>${fmtN(list[i+1].p)}</b>。<br><span style="color:var(--text-2)">差额</span> <b>${fmtN(diff)}</b>，按月存 ${fmtN(S.fire.save)} 算，相当于 <b style="color:var(--brand-2)">少干 ${months} 个月的活</b>。`;
}

// ====================== 理财能力 ======================
let ivFreq = 'monthly'; // monthly | weekly
function renderInvest(){
  const sel = $('#iv-year');
  sel.innerHTML = (Object.keys(S.yearly).map(y=>`<option value="${y}">${y} 年</option>`).join('') || '<option value="2026">2026 年</option>');
  $('#iv-target-lbl').textContent = S.invest.target+'%';

  if(ivFreq==='monthly') drawInvestMonthly();
  else drawInvestWeekly();
}

function drawInvestMonthly(){
  const arr = S.monthly;
  const W=680, H=320, x0=44, x1=W-20, yT=24, yB=200, bz=246, bT=214, bB=278;
  // 输入网格
  const grid = $('#iv-input-grid');
  grid.style.gridTemplateColumns = 'repeat(12, minmax(0,1fr))';
  grid.innerHTML = Array.from({length:12}, (_,i)=>{
    const v = arr[i] ? arr[i].r : '';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:11px;color:var(--text-3)">${i+1}月</span><input class="cell-input" data-i="${i}" value="${v}" placeholder="—" inputmode="decimal"></div>`;
  }).join('');
  $$('#iv-input-grid .cell-input').forEach(inp=>{
    inp.oninput = e => {
      const i=+e.target.dataset.i;
      const v = e.target.value.trim();
      if(v===''){ arr[i]=null; }
      else {
        const n = parseFloat(v);
        if(isFinite(n)){ arr[i] = { y:`2026-${pad(i+1)}`, r:n }; }
      }
      save(); renderInvest();
    };
  });

  // 计算累计
  const cum=[], bc=[]; let c=1, b=1; let n=0; let maxA=1;
  for(let i=0;i<12;i++){
    if(arr[i]!==null && arr[i]!==undefined){ n=i+1; maxA=Math.max(maxA, Math.abs(arr[i].r)); }
  }
  for(let i=0;i<12;i++){
    if(arr[i]!==null && arr[i]!==undefined && i<n){ c *= 1+arr[i].r/100; cum.push((c-1)*100); } else cum.push(null);
    if(i<n){ b *= 1+S.invest.benchMonthly[i]/100; bc.push((b-1)*100); } else bc.push(null);
  }
  const all = cum.concat(bc).filter(v=>v!==null).concat([0, S.invest.target]);
  const lo = Math.floor((Math.min.apply(null,all)-1)/2)*2, hi = Math.ceil((Math.max.apply(null,all)+1)/2)*2;
  function X(i){ return x0 + (x1-x0)*i/11 }
  function Y(v){ return yT + (hi-v)/(hi-lo)*(yB-yT) }
  function pts(arr){ let s=''; arr.forEach((v,i)=>{ if(v===null) return; s += (s?' ':'')+X(i).toFixed(1)+','+Y(v).toFixed(1); }); return s }
  let g = '';
  for(let t=lo; t<=hi; t+=2){
    g += `<line x1="${x0}" y1="${Y(t).toFixed(1)}" x2="${x1}" y2="${Y(t).toFixed(1)}" stroke="${t===0?'var(--border-2)':'var(--border)'}" stroke-width=".5"/>`;
    if(t===lo||t===hi||t===0) g += `<text x="${x0-6}" y="${Y(t)+4}" text-anchor="end" font-size="11" fill="var(--text-3)">${t}%</text>`;
  }
  g += `<line x1="${x0}" y1="${Y(S.invest.target).toFixed(1)}" x2="${x1}" y2="${Y(S.invest.target).toFixed(1)}" stroke="#1D9E75" stroke-width="1" stroke-dasharray="4 3"/>`;
  g += `<polyline points="${pts(bc)}" fill="none" stroke="#A1A09B" stroke-width="1.5" stroke-dasharray="5 3"/>`;
  g += `<polyline points="${pts(cum)}" fill="none" stroke="#2F6BD8" stroke-width="2.5" stroke-linejoin="round"/>`;
  cum.forEach((v,i)=>{ if(v===null) return; g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="#2F6BD8"/>`; });
  // 柱状图
  g += `<line x1="${x0}" y1="${bz}" x2="${x1}" y2="${bz}" stroke="var(--border-2)" stroke-width=".5"/>`;
  arr.forEach((d,i)=>{
    if(!d){ g += `<text x="${X(i).toFixed(1)}" y="${bB+16}" text-anchor="middle" font-size="11" fill="var(--text-3)">${i+1}月</text>`; return; }
    const v=d.r; const h=Math.abs(v)/Math.max(maxA,1)*60; const up=v>=0;
    g += `<rect x="${(X(i)-13).toFixed(1)}" y="${(up?bz-h:bz).toFixed(1)}" width="26" height="${Math.max(2,h).toFixed(1)}" fill="${up?'#D84A4A':'#4F9D2B'}" rx="2"/>`;
    g += `<text x="${X(i).toFixed(1)}" y="${bB+16}" text-anchor="middle" font-size="11" fill="var(--text-3)">${i+1}月</text>`;
  });
  $('#iv-svg').innerHTML = '<title>截止当月的年利率曲线</title>' + g;

  // 指标
  const last = n>0?cum[n-1]:0; const bl = n>0?bc[n-1]:0;
  const ann = n>0 ? (Math.pow(1+last/100, 12/n)-1)*100 : 0;
  $('#iv-cum').textContent = (last>=0?'+':'') + last.toFixed(2)+'%';
  $('#iv-cut').textContent = n+' 月';
  $('#iv-ann').textContent = (ann>=0?'+':'')+ann.toFixed(2)+'%';
  $('#iv-exc').textContent = ((last-bl)>=0?'+':'')+(last-bl).toFixed(2)+'%';
  $('#iv-amt').textContent = (last>=0?'+':'')+fmtN(S.invest.base*last/100);

  // 表格
  const tb = $('#iv-tbl tbody');
  tb.innerHTML = arr.map((d,i)=>{
    if(!d) return `<tr><td>${i+1}月</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></tr>`;
    const c2 = cum[i]===null?'—':(cum[i]>=0?'+':'')+cum[i].toFixed(2)+'%';
    const b2 = bc[i]===null?'—':(bc[i]>=0?'+':'')+bc[i].toFixed(2)+'%';
    const e2 = (cum[i]!==null && bc[i]!==null)?((cum[i]-bc[i]>=0?'+':'')+(cum[i]-bc[i]).toFixed(2)+'%'):'—';
    return `<tr><td>${i+1}月</td><td class="num ${d.r>=0?'up':'down'}">${d.r>=0?'+':''}${d.r.toFixed(2)}%</td><td class="num muted">${b2}</td><td class="num">${e2}</td><td class="num">${c2}</td></tr>`;
  }).join('');

  // 评级
  const rating = computeRating(last, bl);
  $('#iv-rate-name').textContent = rating.name;
  $('#iv-rate-desc').textContent = rating.desc;
}

function drawInvestWeekly(){
  // 简化：周录模式展示 52 周 strip；空周 = 0；月统计由周累计
  const arr = S.weekly.length===52 ? S.weekly : new Array(52).fill(0);
  S.weekly = arr;
  const W=680, H=320, x0=44, x1=W-20, yT=24, yB=200, bz=246, bT=214, bB=278;
  // 输入网格：53 列
  const grid = $('#iv-input-grid');
  grid.style.gridTemplateColumns = 'repeat(53, minmax(0,1fr))';
  grid.innerHTML = Array.from({length:52}, (_,i)=>{
    const v = arr[i] || '';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px"><span style="font-size:9px;color:var(--text-3)">${(i+1)%4===0?(i+1):''}</span><input class="cell-input" data-i="${i}" value="${v}" placeholder="—" inputmode="decimal" style="font-size:10px;padding:2px 0"></div>`;
  }).join('');
  $$('#iv-input-grid .cell-input').forEach(inp=>{
    inp.oninput = e => {
      const i=+e.target.dataset.i;
      const v = e.target.value.trim();
      arr[i] = v===''?0:parseFloat(v);
      if(!isFinite(arr[i])) arr[i]=0;
      save(); renderInvest();
    };
  });

  // 按月聚合：把 52 周按月归并（4-5 周/月）
  const monthBuckets = [[0,4],[4,8],[8,13],[13,17],[17,22],[22,26],[26,30],[30,35],[35,39],[39,43],[43,47],[47,52]];
  const monthly = monthBuckets.map(([s,e])=>{
    const ws = arr.slice(s,e);
    let cum=1; ws.forEach(r=>{ cum *= 1+r/100; });
    return (cum-1)*100;
  });
  const bench = S.invest.benchMonthly;
  let cumAll=1, benchAll=1; let n=0;
  const cum=[], bc=[]; let maxA=1;
  for(let i=0;i<12;i++){
    if(monthly[i]!==0){ n=i+1; maxA=Math.max(maxA,Math.abs(monthly[i])); }
  }
  for(let i=0;i<12;i++){
    if(i<n){ cumAll *= 1+monthly[i]/100; cum.push((cumAll-1)*100); benchAll *= 1+bench[i]/100; bc.push((benchAll-1)*100); }
    else { cum.push(null); bc.push(null); }
  }
  const all = cum.concat(bc).filter(v=>v!==null).concat([0, S.invest.target]);
  const lo = Math.floor((Math.min.apply(null,all)-1)/2)*2, hi = Math.ceil((Math.max.apply(null,all)+1)/2)*2;
  function X(i){ return x0 + (x1-x0)*i/11 }
  function Y(v){ return yT + (hi-v)/(hi-lo)*(yB-yT) }
  function pts(arr){ let s=''; arr.forEach((v,i)=>{ if(v===null) return; s += (s?' ':'')+X(i).toFixed(1)+','+Y(v).toFixed(1); }); return s }
  let g = '';
  for(let t=lo; t<=hi; t+=2){
    g += `<line x1="${x0}" y1="${Y(t).toFixed(1)}" x2="${x1}" y2="${Y(t).toFixed(1)}" stroke="${t===0?'var(--border-2)':'var(--border)'}" stroke-width=".5"/>`;
    if(t===lo||t===hi||t===0) g += `<text x="${x0-6}" y="${Y(t)+4}" text-anchor="end" font-size="11" fill="var(--text-3)">${t}%</text>`;
  }
  g += `<line x1="${x0}" y1="${Y(S.invest.target).toFixed(1)}" x2="${x1}" y2="${Y(S.invest.target).toFixed(1)}" stroke="#1D9E75" stroke-width="1" stroke-dasharray="4 3"/>`;
  g += `<polyline points="${pts(bc)}" fill="none" stroke="#A1A09B" stroke-width="1.5" stroke-dasharray="5 3"/>`;
  g += `<polyline points="${pts(cum)}" fill="none" stroke="#2F6BD8" stroke-width="2.5" stroke-linejoin="round"/>`;
  cum.forEach((v,i)=>{ if(v===null) return; g += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" fill="#2F6BD8"/>`; });
  // 柱状图用月度聚合
  g += `<line x1="${x0}" y1="${bz}" x2="${x1}" y2="${bz}" stroke="var(--border-2)" stroke-width=".5"/>`;
  monthly.forEach((v,i)=>{
    if(i>=n){ g += `<text x="${X(i).toFixed(1)}" y="${bB+16}" text-anchor="middle" font-size="11" fill="var(--text-3)">${i+1}月</text>`; return; }
    const h=Math.abs(v)/Math.max(maxA,1)*60; const up=v>=0;
    g += `<rect x="${(X(i)-13).toFixed(1)}" y="${(up?bz-h:bz).toFixed(1)}" width="26" height="${Math.max(2,h).toFixed(1)}" fill="${up?'#D84A4A':'#4F9D2B'}" rx="2"/>`;
    g += `<text x="${X(i).toFixed(1)}" y="${bB+16}" text-anchor="middle" font-size="11" fill="var(--text-3)">${i+1}月</text>`;
  });
  $('#iv-svg').innerHTML = '<title>截止当月的年利率曲线（周聚合）</title>' + g;

  const last = n>0?cum[n-1]:0; const bl = n>0?bc[n-1]:0;
  const ann = n>0 ? (Math.pow(1+last/100, 12/n)-1)*100 : 0;
  $('#iv-cum').textContent = (last>=0?'+':'') + last.toFixed(2)+'%';
  $('#iv-cut').textContent = n+' 月';
  $('#iv-ann').textContent = (ann>=0?'+':'')+ann.toFixed(2)+'%';
  $('#iv-exc').textContent = ((last-bl)>=0?'+':'')+(last-bl).toFixed(2)+'%';
  $('#iv-amt').textContent = (last>=0?'+':'')+fmtN(S.invest.base*last/100);

  // 表格用月度聚合
  const tb = $('#iv-tbl tbody');
  tb.innerHTML = monthly.map((v,i)=>{
    if(i>=n) return `<tr><td>${i+1}月</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td><td class="num muted">—</td></tr>`;
    const c2 = cum[i]>=0?'+':''; const b2 = bc[i]>=0?'+':'';
    return `<tr><td>${i+1}月</td><td class="num ${v>=0?'up':'down'}">${v>=0?'+':''}${v.toFixed(2)}%</td><td class="num muted">${b2}${bc[i].toFixed(2)}%</td><td class="num">${((cum[i]-bc[i])>=0?'+':'')+(cum[i]-bc[i]).toFixed(2)}%</td><td class="num">${c2}${cum[i].toFixed(2)}%</td></tr>`;
  }).join('');

  const rating = computeRating(last, bl);
  $('#iv-rate-name').textContent = rating.name;
  $('#iv-rate-desc').textContent = rating.desc;
}

function computeRating(my, bench){
  const diff = my - bench;
  if(my===0) return {name:'数据不足', desc:'至少录入一个月才能评级'};
  if(diff<-1) return {name:'新手', desc:`跑输基准 ${Math.abs(diff).toFixed(1)}%，保持记录`};
  if(diff<1) return {name:'跟得上大盘', desc:'与基准持平，继续积累数据'};
  if(diff<3) return {name:'有超额', desc:`跑赢基准 ${diff.toFixed(1)}% · 正在形成能力`};
  return {name:'稳定超额', desc:`跑赢基准 ${diff.toFixed(1)}% · 能力初步成型`};
}

function toggleFreq(){
  ivFreq = ivFreq==='monthly'?'weekly':'monthly';
  $('#iv-freq').textContent = ivFreq==='monthly'?'月度':'周度';
  $('#iv-freq-btn').textContent = ivFreq==='monthly'?'切到周录':'切到月录';
  renderInvest();
}

// ====================== 设置 ======================
function renderSettings(){
  const p=S.profile, pn=S.pension, f=S.fire, iv=S.invest, py=S.payday;
  $('#set-work-start').value = p.workStart;
  $('#set-work-end').value = p.workEnd;
  $('#set-lunch-start').value = p.lunchStart;
  $('#set-lunch-end').value = p.lunchEnd;
  $('#set-salary').value = p.salary;
  const pd = payDays();
  const pdEl = $('#set-days-auto');
  if(pdEl) pdEl.innerHTML = `本月 <b style="color:var(--text)">${pd}</b> 天 · 日薪 <b style="color:var(--text)">${fmt(dailyPay())}</b>`;
  const hdEl = $('#set-holidays');
  if(hdEl) hdEl.value = holidaysToText();
  const upEl = document.querySelectorAll('input[name=unpunched]');
  if(upEl) upEl.forEach(r=>r.checked = (r.value===p.unpunchedMode));
  $('#set-ot-w').value = p.otW;
  $('#set-ot-we').value = p.otWe;
  $('#set-hire').value = p.hireDate;
  $('#set-bonus').value = p.bonus;
  $('#set-bonus-amort').value = p.bonusAmort?'1':'0';
  $('#set-city').value = S.user.city;
  $('#set-pay-type').value = py.type;
  $('#set-pay-day').value = py.day;
  $('#set-pay-rule').value = py.rule;
  $('#set-pay-amt').value = py.amount;
  $('#set-pn-paid').value = pn.paid;
  $('#set-pn-pers').value = pn.personal;
  $('#set-pn-wage').value = pn.wage;
  $('#set-pn-idx').value = pn.idx;
  $('#set-pn-rate').value = pn.rate;
  $('#set-pn-age').value = pn.age;
  $('#set-fr-tgt').value = f.target;
  $('#set-fr-spend').value = f.spend;
  $('#set-fr-save').value = f.save;
  $('#set-fr-rate').value = f.rate;
  $('#set-iv-tgt').value = iv.target;
  $('#set-iv-bench').value = iv.benchmark;
  $('#set-iv-bench-v').value = iv.benchMonthly.join(',');
  $('#set-iv-base').value = iv.base;
}

function saveSettings(){
  const p=S.profile, pn=S.pension, f=S.fire, iv=S.invest, py=S.payday;
  p.workStart = $('#set-work-start').value;
  p.workEnd = $('#set-work-end').value;
  p.lunchStart = $('#set-lunch-start').value;
  p.lunchEnd = $('#set-lunch-end').value;
  p.salary = +$('#set-salary').value;
  S.holidays = textToHolidays($('#set-holidays') ? $('#set-holidays').value : '');
  p.unpunchedMode = (document.querySelector('input[name=unpunched]:checked')||{}).value || 'standard';
  p.otW = +$('#set-ot-w').value;
  p.otWe = +$('#set-ot-we').value;
  p.hireDate = $('#set-hire').value;
  p.bonus = +$('#set-bonus').value;
  p.bonusAmort = $('#set-bonus-amort').value==='1';
  S.user.city = $('#set-city').value;
  py.type = $('#set-pay-type').value;
  py.day = +$('#set-pay-day').value;
  py.rule = $('#set-pay-rule').value;
  py.amount = +$('#set-pay-amt').value;
  pn.paid = +$('#set-pn-paid').value;
  pn.personal = +$('#set-pn-pers').value;
  pn.wage = +$('#set-pn-wage').value;
  pn.idx = +$('#set-pn-idx').value;
  pn.rate = +$('#set-pn-rate').value;
  pn.age = +$('#set-pn-age').value;
  f.target = +$('#set-fr-tgt').value;
  f.spend = +$('#set-fr-spend').value;
  f.save = +$('#set-fr-save').value;
  f.rate = +$('#set-fr-rate').value;
  iv.target = +$('#set-iv-tgt').value;
  iv.benchmark = $('#set-iv-bench').value;
  iv.benchMonthly = $('#set-iv-bench-v').value.split(',').map(s=>parseFloat(s.trim())).filter(x=>isFinite(x));
  if(iv.benchMonthly.length!==12) iv.benchMonthly = DEFAULT.invest.benchMonthly.slice();
  iv.base = +$('#set-iv-base').value;
  save(); toast('设置已保存');
}

function resetSettings(){
  if(!confirm('恢复默认设置？现有数据保留。')) return;
  S.profile = JSON.parse(JSON.stringify(DEFAULT.profile));
  S.payday = JSON.parse(JSON.stringify(DEFAULT.payday));
  S.pension = JSON.parse(JSON.stringify(DEFAULT.pension));
  S.fire = JSON.parse(JSON.stringify(DEFAULT.fire));
  S.invest = JSON.parse(JSON.stringify(DEFAULT.invest));
  save(); renderSettings(); toast('已恢复默认');
}

function exportData(){
  const blob = new Blob([JSON.stringify(S,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dqrd_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  toast('已导出');
}
function importData(file){
  const r = new FileReader();
  r.onload = e => {
    try{
      const obj = JSON.parse(e.target.result);
      S = Object.assign({}, DEFAULT, obj);
      save(); toast('已导入'); render();
    }catch(err){ toast('导入失败：JSON 格式错误'); }
  };
  r.readAsText(file);
}
function clearAll(){
  if(!confirm('清空所有数据（包括盈亏记录、资产、设置）？此操作不可恢复，建议先导出。')) return;
  localStorage.removeItem(STORE);
  S = load();
  render(); toast('已清空');
}
function loadDemo(force){
  if(!force && Object.keys(S.yearly).length>1) return;
  S = JSON.parse(JSON.stringify(DEFAULT));
  // 填充 2025 年数据用于多年叠加
  S.yearly = { '2025': {cum:4.8}, '2026': null };
  save(); render(); toast('已填入示例数据');
}

document.addEventListener('DOMContentLoaded', ()=>{
  // 导入按钮
  $('#import-file').addEventListener('change', e=>{ if(e.target.files[0]) importData(e.target.files[0]); });
  // 滑动条实时联动
  $('#pn-target').addEventListener('input', renderPension);
  $('#fr-target-slider').addEventListener('input', ()=>{ S.fire.target=+$('#fr-target-slider').value; renderFire(); });
  $('#fr-spend-slider').addEventListener('input', ()=>{ S.fire.spend=+$('#fr-spend-slider').value; renderFire(); });
  $('#fr-my-rate').addEventListener('input', drawFireLink);
  $$('#fr-curve').forEach(_=>{});
  // 年化切换按钮
  $$('button[data-rate]').forEach(b=>{
    b.onclick = ()=>{
      $$('button[data-rate]').forEach(x=>{ x.classList.remove('primary'); x.classList.add('ghost'); });
      b.classList.add('primary'); b.classList.remove('ghost');
      curFireRate = +b.dataset.rate; renderFire();
    };
  });
  // 摸鱼/加班按钮事件
  $$('button[data-rate]').forEach(b=>{}); // already
  $$('.tab-bar .tab').length || (function(){ /* placeholder */ })();
  // 模式切换
  $('#btnMode').onclick = ()=>{
    document.documentElement.toggleAttribute('data-mode');
    const dark = document.documentElement.hasAttribute('data-mode');
    document.documentElement.dataset.mode = dark?'dark':'';
    $('#btnMode').textContent = dark?'正常模式':'摸鱼模式';
  };
  // tab bar（mobile）
  renderTabBar(location.hash.replace('#','')||'today');
  // 路由
  if(!location.hash) location.hash = '#today';
  route();
  if(S.monthly.length===0 && S.yearly && Object.keys(S.yearly).length===0) loadDemo(true);
  // 全局点击路由
  $$('.nav-item').forEach(n=>{
    n.onclick = ()=>{ location.hash = n.dataset.route; };
  });
  // 日期显示
  const now = new Date();
  const w = ['日','一','二','三','四','五','六'];
  $('#pageDate').textContent = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} 周${w[now.getDay()]}`;
});

function renderTabBar(active){
  const items = [
    {r:'today', l:'今日', i:'◐'},
    {r:'assets', l:'资产', i:'◇'},
    {r:'pension', l:'养老', i:'◯'},
    {r:'fire', l:'FIRE', i:'▣'},
    {r:'invest', l:'理财', i:'▲'},
  ];
  const bar = $('#tabBar');
  bar.innerHTML = items.map(it=>`<div class="tab ${it.r===active?'active':''}" data-route="${it.r}"><span class="nav-ico">${it.i}</span><span>${it.l}</span></div>`).join('');
  $$('#tabBar .tab').forEach(t=>{ t.onclick = ()=>{ location.hash = t.dataset.route; }; });
}

function quickAdd(){ openSheet('quickadd'); }

function openSheet(kind){
  const bg = $('#modalBg'); bg.classList.remove('hidden');
  const body = $('#modalBody');
  let html = '';
  if(kind==='slacker'){
    html = `<h3>摸鱼计算器</h3><div class="field"><label>摸鱼分钟</label><input type="number" id="sl-mins" min="1" value="15"></div><p class="muted" style="font-size:13px" id="sl-out"></p>`;
    body.innerHTML = html;
    const update = ()=>{
      const m = +$('#sl-mins').value;
      const p = S.profile;
      const ws=parseHM(p.workStart), we=parseHM(p.workEnd), ls=parseHM(p.lunchStart), le=parseHM(p.lunchEnd);
      const workMins = (we-ws)-(le-ls);
      const rate = dailyPay() / (workMins/60);
      const cost = rate/60*m;
      $('#sl-out').innerHTML = `这 <b>${m} 分钟</b> 值 <b style="color:var(--brand-2)">${fmt(cost)}</b>，相当于一杯 <b>${(cost/9).toFixed(0)}</b> 块瑞幸。值得吗？`;
    };
    $('#sl-mins').addEventListener('input', update); update();
  }
  else if(kind==='overtime'){
    html = `<h3>加班登记</h3><div class="field"><label>加班小时</label><input type="number" id="ot-h" min="0.5" step="0.5" value="1"></div><div class="field"><label>类型</label><select id="ot-t"><option value="weekday">工作日（1.5x）</option><option value="weekend">周末（2x）</option></select></div><p class="muted" style="font-size:13px" id="ot-out"></p>`;
    body.innerHTML = html;
    const update = ()=>{
      const h = +$('#ot-h').value;
      const t = $('#ot-t').value;
      const p = S.profile;
      const workMins = (parseHM(p.workEnd)-parseHM(p.workStart))-(parseHM(p.lunchEnd)-parseHM(p.lunchStart));
      const rate = dailyPay() / (workMins/60);
      const mul = t==='weekday'?p.otW:p.otWe;
      $('#ot-out').textContent = `加班费：${fmt(rate*mul*h)}（已计入今日）`;
    };
    $('#ot-h').addEventListener('input', update); $('#ot-t').addEventListener('change', update); update();
  }
  else if(kind==='payday'){
    html = `<h3>发薪日设置</h3>
      <div class="field"><label>发薪类型</label><select id="md-pay-type"><option value="current_month">当月发当月</option><option value="next_month" selected>次月发上月</option></select></div>
      <div class="field"><label>发薪日期</label><input type="number" id="md-pay-day" min="1" max="31" value="15"></div>
      <div class="field"><label>遇周末/节假日</label><select id="md-pay-rule"><option value="advance">提前发放</option><option value="delay">顺延</option><option value="same">不变</option></select></div>
      <div class="field"><label>预计到账金额</label><input type="number" id="md-pay-amt" value="13500"></div>
      <div class="modal-actions"><button onclick="closeSheet()">取消</button><button class="primary" onclick="savePayday()">保存</button></div>`;
    body.innerHTML = html;
    $('#md-pay-type').value = S.payday.type;
    $('#md-pay-day').value = S.payday.day;
    $('#md-pay-rule').value = S.payday.rule;
    $('#md-pay-amt').value = S.payday.amount;
  }
  else if(kind==='paylog'){
    html = `<h3>工资日历 · 2026</h3>
      <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">${Array.from({length:12},(_,i)=>{
        const d = new Date(2026, i+1, Math.min(S.payday.day, 28));
        const wk = ['日','一','二','三','四','五','六'];
        return `<div class="kv-cell"><p>${i+1}月 ${d.getDate()}日 周${wk[d.getDay()]}</p><h3 class="tnum">¥${fmtN(S.payday.amount)}</h3></div>`;
      }).join('')}</div>
      <div class="modal-actions"><button onclick="closeSheet()">关闭</button></div>`;
    body.innerHTML = html;
  }
  else if(kind==='quickadd'){
    html = `<h3>快速记账</h3>
      <div class="field"><label>类型</label><select id="qa-t"><option value="earn">收入</option><option value="spend">支出</option><option value="invest">投资</option></select></div>
      <div class="field"><label>金额</label><input type="number" id="qa-amt" value="100"></div>
      <div class="field"><label>备注</label><input type="text" id="qa-note" placeholder="例：餐饮"></div>
      <div class="modal-actions"><button onclick="closeSheet()">取消</button><button class="primary" onclick="saveQuick()">保存</button></div>`;
    body.innerHTML = html;
  }
}
function savePayday(){
  S.payday.type = $('#md-pay-type').value;
  S.payday.day = +$('#md-pay-day').value;
  S.payday.rule = $('#md-pay-rule').value;
  S.payday.amount = +$('#md-pay-amt').value;
  save(); closeSheet(); render(); toast('发薪日设置已保存');
}
function saveQuick(){
  const amt = +$('#qa-amt').value; const t = $('#qa-t').value; const note = $('#qa-note').value;
  if(t==='spend'){
    S.accounts.deposits[0].b -= amt;
  } else if(t==='earn'){
    S.accounts.deposits[0].b += amt;
  } else if(t==='invest'){
    S.accounts.invest[0].b += amt;
    S.accounts.deposits[0].b -= amt;
  }
  save(); closeSheet(); render(); toast('已记录');
}
function closeSheet(){ $('#modalBg').classList.add('hidden'); }