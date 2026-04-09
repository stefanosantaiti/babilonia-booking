// Admin Interface v2 - Supabase Direct
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm';

const SUPABASE_URL = 'https://esgjushznmidzdhqsyyx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ2p1c2h6bm1pZHpkaHFzeXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTYwMTcsImV4cCI6MjA5MTIzMjAxN30.cKWfWEkgRTtPKbUduGgNxX6gF18Gqkjg2bWn6twQTbs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSeller = null;
let sellerConfig = {
  days: [1, 2, 3, 4, 5], // Lun-Ven default
  morning: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
  afternoon: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
};

// Carica seller
async function loadSellers() {
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('active', true);
    
  if (error) {
    showStatus('login-status', 'Errore caricamento: ' + error.message, false);
    return;
  }
  
  const select = document.getElementById('seller-select');
  select.innerHTML = '<option value="">-- Seleziona --</option>';
  sellers.forEach(seller => {
    const option = document.createElement('option');
    option.value = seller.id;
    option.textContent = seller.name;
    select.appendChild(option);
  });
}

// Login
async function login() {
  const select = document.getElementById('seller-select');
  currentSeller = parseInt(select.value);
  
  if (!currentSeller) {
    showStatus('login-status', 'Seleziona un consulente', false);
    return;
  }
  
  // Carica configurazione salvata
  const { data: config } = await supabase
    .from('seller_configs')
    .select('*')
    .eq('seller_id', currentSeller)
    .single();
    
  if (config) {
    sellerConfig = {
      days: config.days || [1, 2, 3, 4, 5],
      morning: config.morning || ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
      afternoon: config.afternoon || ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
    };
  }
  
  renderConfigForm();
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadSlots();
  loadAppointments();
}

// Render form configurazione
function renderConfigForm() {
  const container = document.getElementById('config-form');
  
  const days = [
    { value: 1, label: 'Lunedì' },
    { value: 2, label: 'Martedì' },
    { value: 3, label: 'Mercoledì' },
    { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' },
    { value: 6, label: 'Sabato' },
    { value: 0, label: 'Domenica' }
  ];
  
  container.innerHTML = `
    <div class="config-section">
      <h3>📅 Giorni disponibili</h3>
      <div class="days-grid">
        ${days.map(d => `
          <label class="checkbox-label">
            <input type="checkbox" name="day" value="${d.value}" 
              ${sellerConfig.days.includes(d.value) ? 'checked' : ''}>
            ${d.label}
          </label>
        `).join('')}
      </div>
    </div>
    
    <div class="config-section">
      <h3>🕐 Fascia mattina</h3>
      <div class="time-grid">
        ${['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'].map(t => `
          <label class="checkbox-label">
            <input type="checkbox" name="morning" value="${t}"
              ${sellerConfig.morning.includes(t) ? 'checked' : ''}>
            ${t}
          </label>
        `).join('')}
      </div>
    </div>
    
    <div class="config-section">
      <h3>🕐 Fascia pomeriggio</h3>
      <div class="time-grid">
        ${['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'].map(t => `
          <label class="checkbox-label">
            <input type="checkbox" name="afternoon" value="${t}"
              ${sellerConfig.afternoon.includes(t) ? 'checked' : ''}>
            ${t}
          </label>
        `).join('')}
      </div>
    </div>
    
    <button class="btn" onclick="saveConfig()">💾 Salva Configurazione</button>
  `;
}

// Salva configurazione
async function saveConfig() {
  const days = Array.from(document.querySelectorAll('input[name="day"]:checked')).map(cb => parseInt(cb.value));
  const morning = Array.from(document.querySelectorAll('input[name="morning"]:checked')).map(cb => cb.value);
  const afternoon = Array.from(document.querySelectorAll('input[name="afternoon"]:checked')).map(cb => cb.value);
  
  if (days.length === 0) {
    showStatus('config-status', 'Seleziona almeno un giorno', false);
    return;
  }
  
  if (morning.length === 0 && afternoon.length === 0) {
    showStatus('config-status', 'Seleziona almeno una fascia oraria', false);
    return;
  }
  
  sellerConfig = { days, morning, afternoon };
  
  // Salva su Supabase
  const { error } = await supabase
    .from('seller_configs')
    .upsert({ 
      seller_id: currentSeller, 
      days, 
      morning, 
      afternoon,
      updated_at: new Date().toISOString()
    });
    
  if (error) {
    showStatus('config-status', 'Errore salvataggio: ' + error.message, false);
  } else {
    showStatus('config-status', 'Configurazione salvata!', true);
  }
}

// Genera slot
async function generateSlots() {
  showStatus('action-status', 'Generazione slot in corso...', true);
  
  const today = new Date();
  const slots = [];
  
  // Cancella slot futuri
  const todayStr = today.toISOString().split('T')[0];
  await supabase
    .from('slots')
    .delete()
    .eq('seller_id', currentSeller)
    .gte('date', todayStr);
  
  // Genera nuovi slot
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();
    
    if (!sellerConfig.days.includes(dayOfWeek)) continue;
    
    const dateStr = date.toISOString().split('T')[0];
    
    sellerConfig.morning.forEach(time => {
      slots.push({
        id: `${currentSeller}_${dateStr}_${time}`,
        seller_id: currentSeller,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo'
      });
    });
    
    sellerConfig.afternoon.forEach(time => {
      slots.push({
        id: `${currentSeller}_${dateStr}_${time}`,
        seller_id: currentSeller,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo'
      });
    });
  }
  
  if (slots.length > 0) {
    const { error } = await supabase.from('slots').insert(slots);
    
    if (error) {
      showStatus('action-status', 'Errore: ' + error.message, false);
    } else {
      showStatus('action-status', `${slots.length} slot generati!`, true);
      loadSlots();
    }
  } else {
    showStatus('action-status', 'Nessuno slot da generare (controlla config)', false);
  }
}

// Carica slot
async function loadSlots() {
  const container = document.getElementById('slots-container');
  container.innerHTML = '<div class="loading">Caricamento...</div>';
  
  const { data: slots, error } = await supabase
    .from('slots')
    .select('*')
    .eq('seller_id', currentSeller)
    .eq('available', true)
    .order('date', { ascending: true })
    .order('time', { ascending: true });
    
  if (error) {
    container.innerHTML = '<div class="empty-state">Errore caricamento</div>';
    return;
  }
  
  if (!slots || slots.length === 0) {
    container.innerHTML = '<div class="empty-state">Nessuno slot. Configura e genera slot.</div>';
    return;
  }
  
  // Raggruppa per data
  const byDate = {};
  slots.forEach(slot => {
    if (!byDate[slot.date]) byDate[slot.date] = [];
    byDate[slot.date].push(slot);
  });
  
  let html = '';
  Object.keys(byDate).sort().forEach(date => {
    html += `<h3 style="margin: 20px 0 10px 0; color: #1a1a2e;">${formatDate(date)}</h3>`;
    html += '<div class="slots-grid">';
    byDate[date].forEach(slot => {
      html += `<div class="slot slot-available" onclick="toggleSlot('${slot.id}', false)">${slot.time}</div>`;
    });
    html += '</div>';
  });
  
  container.innerHTML = html;
}

// Carica appuntamenti
async function loadAppointments() {
  const container = document.getElementById('appointments-container');
  container.innerHTML = '<div class="loading">Caricamento...</div>';
  
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('*, slots(date, time)')
    .eq('seller_id', currentSeller)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false });
    
  if (error || !appointments || appointments.length === 0) {
    container.innerHTML = '<div class="empty-state">Nessun appuntamento</div>';
    return;
  }
  
  let html = '<div class="appointments-list">';
  appointments.forEach(apt => {
    html += `
      <div class="appointment">
        <div class="appointment-header">${apt.client_name}</div>
        <div class="appointment-details">
          📅 ${formatDate(apt.slots?.date)} ⏰ ${apt.slots?.time}<br>
          📧 ${apt.client_email}${apt.client_phone ? ' | 📱 ' + apt.client_phone : ''}
        </div>
      </div>
    `;
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// Toggle slot
async function toggleSlot(slotId, available) {
  if (!available) {
    if (!confirm('Rendere questo slot non disponibile?')) return;
  }
  
  const { error } = await supabase
    .from('slots')
    .update({ available })
    .eq('id', slotId);
    
  if (!error) loadSlots();
}

// Formatta data
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Mostra status
function showStatus(elementId, message, isSuccess) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = 'status-message ' + (isSuccess ? 'status-success' : 'status-error');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

// Esporta funzioni globali
window.loadSellers = loadSellers;
window.login = login;
window.saveConfig = saveConfig;
window.generateSlots = generateSlots;
window.toggleSlot = toggleSlot;

// Inizializza
loadSellers();
