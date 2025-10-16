/* ---------- CONFIG (SET YOUR IP) ---------- */
const API_BASE = "http://192.168.0.101/parking"; // <— replace with your PC IPv4 (from ipconfig)

/* ---------- SLOTS & POLL ---------- */
const SLOT_IDS = ['A001','A002','A003','A004','B001','B002','B003','B004'];
const TOTAL_SLOTS = SLOT_IDS.length;
const POLL_INTERVAL = 1500; // not used for DB polling (you can add later if you want)
let mockMode = false;

/* ---------- STATE ---------- */
let parked = {}; // { [slotId]: { entry: Date, premium: bool, penalty: bool, contact: string, plate: string } }
let occupiedCount = 0;
let durationHistory = [];
let eventsLog = []; // {slot, plate, contact, entry, exit, duration, fee, premium, penalty, timestamp}
let peakOccupancy = 0;

/* ---------- DOM ---------- */
const totalSlotsEl = document.getElementById('totalSlots');
const occupiedEl = document.getElementById('occupied');
const availableEl = document.getElementById('available');
const peakEl = document.getElementById('peak');
const turnoverEl = document.getElementById('turnover');
const activityBody = document.getElementById('activityBody');
const alertList = document.getElementById('alertList');
const toast = document.getElementById('toast');
const nowEl = document.getElementById('now');
const toggleMockBtn = document.getElementById('toggleMock');
const themeToggle = document.getElementById('themeToggle');
const clearAlertsBtn = document.getElementById('clearAlerts');
const ackAlertsBtn = document.getElementById('ackAlerts');
const openGateBtn = document.getElementById('openGate');
const closeGateBtn = document.getElementById('closeGate');
const resetBtn = document.getElementById('resetSystem');

const contactTypeSel = document.getElementById('contactType');
const contactInput = document.getElementById('contactInput');
const plateInput = document.getElementById('plateInput');

totalSlotsEl.textContent = TOTAL_SLOTS;

/* ---------- UTIL ---------- */
function showToast(msg){
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.style.display='none', 2200);
}
function nowStr(d=new Date()){ return d.toLocaleString(); }
function timeStr(d){ return d ? new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''; }
function hoursFloat(ms){ return +(ms/1000/60/60).toFixed(2); }
function ceilHours(n){ return Math.ceil(n); }
function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function iso(d){ return new Date(d).toISOString().slice(0,19).replace('T',' '); } // "YYYY-MM-DD HH:MM:SS"

/* ---------- SIMPLE FETCH HELPERS ---------- */
function postForm(url, dataObj){
  const body = Object.entries(dataObj)
    .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v ?? '')}`)
    .join('&');
  return fetch(`${url}?_=${Date.now()}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  }).then(r => r.json());
}
function getJSON(url){
  return fetch(`${url}?_=${Date.now()}`).then(r => r.json());
}

/* ---------- PRICING ---------- */
function computeFee(durationHours, { premium=false, penalty=false } = {}){
  let fee = 0;
  if(premium){ fee = 30; }
  else {
    if(durationHours <= 2) fee = 0;
    else if(durationHours > 6) fee = 23;
    else { fee = ceilHours(durationHours - 2) * 1; }
  }
  if(penalty) fee += 50;
  return fee;
}

/* ---------- UI ---------- */
function updateStatsUI(){
  occupiedEl.textContent = occupiedCount;
  availableEl.textContent = TOTAL_SLOTS - occupiedCount;
  const pct = Math.round((occupiedCount / TOTAL_SLOTS) * 100);
  peakOccupancy = Math.max(peakOccupancy, pct);
  peakEl.textContent = `Peak Today: ${peakOccupancy}%`;
  const avg = durationHistory.length ? (durationHistory.reduce((a,b)=>a+b,0)/durationHistory.length).toFixed(2) : '0.00';
  turnoverEl.textContent = `Avg Duration: ${avg}h`;
}

function renderActivityTable(){
  activityBody.innerHTML = '';
  const combined = eventsLog.slice().reverse();
  for(const ev of combined){
    const tr = document.createElement('tr');
    const actionButtons = ev.exit ? '' : `
      <button class="action-btn" data-act="checkout" data-spot="${ev.slot}">Checkout</button>
      <button class="action-btn" data-act="togglePremium" data-spot="${ev.slot}">
        ${ev.premium ? 'Unmark Premium' : 'Mark Premium'}
      </button>
      <button class="action-btn" data-act="togglePenalty" data-spot="${ev.slot}">
        ${ev.penalty ? 'Remove Penalty' : 'Add Penalty'}
      </button>
    `;
    tr.innerHTML = `
      <td>${ev.slot}</td>
      <td>${ev.plate || '—'}</td>
      <td>${ev.contact || '—'}</td>
      <td>${timeStr(ev.entry)}</td>
      <td>${ev.exit ? timeStr(ev.exit) : ''}</td>
      <td>${ev.duration !== null ? ev.duration : ''}</td>
      <td>RM ${ev.fee !== null ? (+ev.fee).toFixed(2) : ''}</td>
      <td>${actionButtons}</td>
    `;
    activityBody.appendChild(tr);
  }
}

/* ---------- Alerts ---------- */
function addAlert(type, msg, where='System'){
  const node = document.createElement('div');
  node.className = `alert ${type}`;
  node.innerHTML = `<div class="when">${timeStr(new Date())} • ${where}</div><div class="msg">${msg}</div>`;
  alertList.prepend(node);
  while(alertList.children.length > 8) alertList.lastElementChild.remove();
}

/* ---------- Events (local log) ---------- */
function pushEvent(slot, entryDate, exitDate=null, fee=null, premium=false, penalty=false, contact='', plate=''){
  const duration = exitDate ? hoursFloat(new Date(exitDate) - new Date(entryDate)) : null;
  const ev = {
    slot,
    plate,
    contact,
    entry: entryDate,
    exit: exitDate,
    duration: duration !== null ? +duration.toFixed(2) : null,
    fee: fee !== null ? +Number(fee).toFixed(2) : null,
    premium: !!premium,
    penalty: !!penalty,
    timestamp: new Date().toISOString()
  };
  eventsLog.push(ev);
  if(eventsLog.length > 2000) eventsLog.shift();
  renderActivityTable();
}

function getAvailableSlots(){
  return SLOT_IDS.filter(id => !(id in parked));
}
function getOccupiedSlots(){
  return Object.keys(parked);
}

/* ---------- DB FUNCTIONS ---------- */
// Expect PHP endpoints:
// - GET  : `${API_BASE}/get_activity.php` -> [{slot,plate,contact,entry_time,exit_time,duration,fee}, ...]
// - POST : `${API_BASE}/save_entry.php`   -> {status:'success'|'error', msg?}
// - POST : `${API_BASE}/update_exit.php`  -> {status:'success'|'error', msg?}

function saveEntryToDB({slot, plate, contact, entry}){
  return postForm(`${API_BASE}/save_entry.php`, {
    slot, plate, contact, entry_time: iso(entry)
  }).then(res => {
    if(res.status === "success"){
      showToast("Saved to database ✅");
    } else {
      showToast("DB error: " + (res.msg || 'unknown'));
    }
  }).catch(err => {
    showToast("Network error: " + err);
  });
}

function updateExitInDB({slot, exit, duration, fee}){
  // Server should "close" the latest open row for this slot (exit_time IS NULL)
  return postForm(`${API_BASE}/update_exit.php`, {
    slot,
    exit_time: iso(exit),
    duration: duration.toFixed(2),
    fee: (+fee).toFixed(2)
  }).then(res => {
    if(res.status === "success"){
      showToast("Checkout saved to DB ✅");
    } else {
      showToast("DB error: " + (res.msg || 'unknown'));
    }
  }).catch(err => {
    showToast("Network error: " + err);
  });
}

function loadActivityFromDB(){
  return getJSON(`${API_BASE}/get_activity.php`)
    .then(data => {
      // Reset local state
      parked = {}; eventsLog = []; occupiedCount = 0; durationHistory = []; peakOccupancy = 0;

      // Ingest DB data into UI model
      (data || []).forEach(row => {
        const entry = row.entry_time ? new Date(row.entry_time) : null;
        const exit  = row.exit_time  ? new Date(row.exit_time)  : null;
        const fee   = row.fee != null ? Number(row.fee) : null;

        pushEvent(row.slot, entry, exit, fee, false, false, row.contact, row.plate);

        if(!exit && entry){
          parked[row.slot] = { entry, premium:false, penalty:false, contact: row.contact, plate: row.plate };
          occupiedCount++;
        }
        if(exit && entry){
          durationHistory.push(hoursFloat(exit - entry));
        }
      });

      updateStatsUI();
      renderActivityTable();
    })
    .catch(err => {
      showToast("Failed to load DB: " + err);
      addAlert('warn', 'Could not load from database. Showing local state only.', 'DB');
    });
}

/* ---------- Entry & Exit (wired to DB) ---------- */
function handleEntry(contact='', plate=''){
  const available = getAvailableSlots();
  if(available.length === 0){
    addAlert('warn','No available spots - parking is full.','System');
    return;
  }
  const slot = available[0];
  const now = new Date();

  // Local state update
  parked[slot] = { entry: now, premium:false, penalty:false, contact, plate };
  occupiedCount++;
  pushEvent(slot, now, null, null, false, false, contact, plate);
  updateStatsUI();
  addAlert('ok', `Vehicle ${plate || '(no plate)'} entered into ${slot}.`, 'Entry Gate');

  // Persist to DB
  saveEntryToDB({slot, plate, contact, entry: now});
}

function handleExit(slot){
  const info = parked[slot];
  if(!info){
    addAlert('warn', `Exit called but ${slot} was not occupied.`, slot);
    return;
  }
  const exitTime = new Date();
  const durationHours = hoursFloat(exitTime - new Date(info.entry));
  const fee = computeFee(durationHours, { premium: info.premium, penalty: info.penalty });

  // Local state update
  delete parked[slot];
  occupiedCount = Math.max(0, occupiedCount - 1);

  pushEvent(slot, info.entry, exitTime, fee, info.premium, info.penalty, info.contact, info.plate);
  durationHistory.push(durationHours);
  updateStatsUI();

  if(info.premium) addAlert('ok', `Premium package used at ${slot}`, slot);
  if(info.penalty) addAlert('danger', `Penalty applied at ${slot}`, slot);
  if(durationHours > 4) addAlert('warn', `Vehicle at ${slot} overstayed.`, slot);

  showToast(`Exit processed for ${slot} — RM ${fee.toFixed(2)}`);

  // Persist to DB (close the open row for this slot)
  updateExitInDB({ slot, exit: exitTime, duration: durationHours, fee });
}

/* ---------- Add Entry from form ---------- */
function addEntryFromForm(){
  const plate = (plateInput.value || '').trim();
  if(!plate){
    showToast('Please enter plate number.');
    plateInput.focus();
    return;
  }

  const type = contactTypeSel.value;
  const value = (contactInput.value || '').trim();

  if(!value){
    showToast('Please enter an email or phone.');
    contactInput.focus();
    return;
  }

  if(type === 'email'){
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if(!ok){ showToast('Invalid email format'); contactInput.focus(); return; }
  } else {
    const ok = /^[0-9+\-\s()]{6,18}$/.test(value);
    if(!ok){ showToast('Invalid phone number'); contactInput.focus(); return; }
  }

  handleEntry(`${type}: ${value}`, plate);
  contactInput.value = '';
  plateInput.value = '';
}

/* ---------- Charts ---------- */
const trendsCtx = document.getElementById('trendsChart');
const reportsCtx = document.getElementById('reportsChart');

const trendsChart = new Chart(trendsCtx, {
  type: 'line',
  data: {
    labels: Array.from({length: 10}, (_, i) => `${i*10}m ago`).reverse(),
    datasets: [{
      label: 'Occupancy %',
      data: [],
      tension: 0.35,
      fill: true,
      backgroundColor: 'rgba(59,130,246,0.12)',
      borderColor: '#3b82f6',
      borderWidth: 2,
      pointRadius: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { suggestedMin: 0, suggestedMax: 100, title: { display: true, text: 'Occupancy (%)' } },
      x: { title: { display: true, text: 'Time' } }
    }
  }
});

const reportsChart = new Chart(reportsCtx, {
  type: 'bar',
  data: {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [{
      label: 'Vehicles / Day',
      data: [45, 62, 58, 75, 80, 50, 30],
      backgroundColor: 'rgba(20,184,166,0.35)',
      borderColor: '#14b8a6',
      borderWidth: 1
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { title: { display: true, text: 'Number of Vehicles' } },
      x: { title: { display: true, text: 'Day of Week' } }
    }
  }
});

function pushOccupancyPct(value){
  const ds = trendsChart.data.datasets[0].data;
  if(ds.length >= 10) ds.shift();
  ds.push(value);
  trendsChart.update();
}

/* ---------- Mock mode ---------- */
function runMockMode(){
  if(!mockMode) return;
  const action = rand(1,3);
  const occ = getOccupiedSlots();

  if(action === 1 && occ.length < TOTAL_SLOTS){
    const t = Math.random() < 0.5 ? 'email' : 'phone';
    const contact = t === 'email' ? `email: user${rand(1,99)}@ex.com` : `phone: 01${rand(10000000,99999999)}`;
    const plate = `ABC${rand(1000,9999)}`;
    handleEntry(contact, plate);
  } else if(action === 2 && occ.length > 0){
    const slot = occ[rand(0, occ.length-1)];
    handleExit(slot);
  }
}

/* ---------- Init ---------- */
async function seedInitial(){
  // Load from database instead of fake seeds
  await loadActivityFromDB();
  pushOccupancyPct(Math.round((occupiedCount/TOTAL_SLOTS)*100));
}

document.addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  const act = btn.dataset.act;
  const slot = btn.dataset.spot;
  if(!act) return;

  if(act === 'checkout'){
    handleExit(slot);
  }else if(act === 'togglePremium'){
    if(parked[slot]) { parked[slot].premium = !parked[slot].premium; showToast(`${slot} premium: ${parked[slot].premium?'ON':'OFF'}`); }
    for(let i = eventsLog.length-1; i>=0; i--){
      if(eventsLog[i].slot === slot && !eventsLog[i].exit){ eventsLog[i].premium = parked[slot]?.premium || false; break; }
    }
    renderActivityTable();
  }else if(act === 'togglePenalty'){
    if(parked[slot]) { parked[slot].penalty = !parked[slot].penalty; showToast(`${slot} penalty: ${parked[slot].penalty?'ON':'OFF'}`); }
    for(let i = eventsLog.length-1; i>=0; i--){
      if(eventsLog[i].slot === slot && !eventsLog[i].exit){ eventsLog[i].penalty = parked[slot]?.penalty || false; break; }
    }
    renderActivityTable();
  }
});

themeToggle.addEventListener('click', ()=>{
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
});

clearAlertsBtn.addEventListener('click', ()=>{ alertList.innerHTML=''; showToast('Alerts cleared'); });
ackAlertsBtn.addEventListener('click', ()=>{ alertList.innerHTML=''; showToast('Alerts acknowledged'); });

openGateBtn.addEventListener('click', addEntryFromForm);
closeGateBtn.addEventListener('click', ()=>{
  const occ = getOccupiedSlots();
  if(occ.length > 0){
    const slot = occ[rand(0, occ.length-1)];
    handleExit(slot);
  } else {
    showToast('No vehicles to checkout');
  }
});
resetBtn.addEventListener('click', ()=>{
  parked = {}; eventsLog = []; occupiedCount = 0; durationHistory = []; peakOccupancy = 0;
  renderActivityTable(); updateStatsUI(); showToast('System reset');
});

/* Contact input type/placeholder toggling */
contactTypeSel.addEventListener('change', ()=>{
  if(contactTypeSel.value === 'email'){
    contactInput.type = 'email';
    contactInput.placeholder = 'name@example.com';
  } else {
    contactInput.type = 'tel';
    contactInput.placeholder = '01X-XXXXXXX';
  }
});

seedInitial();
setInterval(()=>{
  nowEl.textContent = nowStr();
  runMockMode();
  const pct = Math.round((occupiedCount / TOTAL_SLOTS) * 100);
  pushOccupancyPct(pct);
}, 1000);
