// Admin Standalone - Usa Supabase direttamente (no Netlify)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://esgjushznmidzdhqsyyx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ2p1c2h6bm1pZHpkaHFzeXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTYwMTcsImV4cCI6MjA5MTIzMjAxN30.cKWfWEkgRTtPKbUduGgNxX6gF18Gqkjg2bWn6twQTbs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSeller = null;

// Carica seller
async function loadSellers() {
  try {
    const { data, error } = await supabase
      .from('sellers')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    const select = document.getElementById('seller-select');
    data.forEach(seller => {
      const option = document.createElement('option');
      option.value = seller.id;
      option.textContent = seller.name;
      select.appendChild(option);
    });
  } catch (error) {
    showStatus('login-status', 'Errore caricamento: ' + error.message, false);
  }
}

// Login
function login() {
  const select = document.getElementById('seller-select');
  currentSeller = parseInt(select.value);
  
  if (!currentSeller) {
    showStatus('login-status', 'Seleziona un consulente', false);
    return;
  }
  
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadConfig();
  loadSlots();
  loadAppointments();
}

// Carica configurazione
async function loadConfig() {
  const container = document.getElementById('config-form');
  
  container.innerHTML = `
    <div class="config-section">
      <h3>📅 Giorni della Settimana</h3>
      <div class="days-grid">
        ${['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map((day, i) => `
          <label class="checkbox-label">
            <input type="checkbox" name="days" value="${i}" checked>
            ${day}
          </label>
        `).join('')}
      </div>
    </div>
    
    <div class="config-section">
      <h3>⏰ Orari Disponibili</h3>
      <div class="time-grid">
        ${['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'].map(time => `
          <label class="checkbox-label">
            <input type="checkbox" name="times" value="${time}" checked>
            ${time}
          </label>
        `).join('')}
      </div>
    </div>
    
    <button class="btn" onclick="saveConfig()">💾 Salva Configurazione</button>
  `;
}

// Salva configurazione
function saveConfig() {
  const days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => parseInt(cb.value));
  const times = Array.from(document.querySelectorAll('input[name="times"]:checked')).map(cb => cb.value);
  
  if (days.length === 0 || times.length === 0) {
    showStatus('config-status', 'Seleziona almeno un giorno e un orario', false);
    return;
  }
  
  localStorage.setItem(`config_${currentSeller}`, JSON.stringify({ days, times }));
  showStatus('config-status', `Configurazione salvata: ${days.length} giorni, ${times.length} slot/giorno`, true);
}

// Genera slot
async function generateSlots() {
  const config = JSON.parse(localStorage.getItem(`config_${currentSeller}`) || '{}');
  
  if (!config.days || !config.times) {
    showStatus('action-status', 'Configura giorni e orari prima', false);
    return;
  }
  
  showStatus('action-status', 'Generazione slot in corso...', true);
  
  const slots = [];
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = (date.getDay() + 6) % 7; // 0=Lunedì
    
    if (!config.days.includes(dayOfWeek)) continue;
    
    const dateStr = date.toISOString().split('T')[0];
    
    config.times.forEach(time => {
      slots.push({
        seller_id: currentSeller,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo'
      });
    });
  }
  
  try {
    // Elimina slot esistenti
    const todayStr = today.toISOString().split('T')[0];
    await supabase
      .from('slots')
      .delete()
      .eq('seller_id', currentSeller)
      .gte('date', todayStr);
    
    // Inserisci nuovi slot
    const { error } = await supabase
      .from('slots')
      .insert(slots);
    
    if (error) throw error;
    
    showStatus('action-status', `Generati ${slots.length} slot per 14 giorni`, true);
    loadSlots();
  } catch (error) {
    showStatus('action-status', 'Errore: ' + error.message, false);
  }
}

// Carica slot
async function loadSlots() {
  const container = document.getElementById('slots-container');
  container.innerHTML = '<div class="loading">Caricamento...</div>';
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('seller_id', currentSeller)
      .gte('date', today)
      .order('date')
      .order('time');
    
    if (error) throw error;
    
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">Nessuno slot. Clicca "Genera Slot 14 Giorni"</div>';
      return;
    }
    
    // Raggruppa per data
    const byDate = {};
    data.forEach(slot => {
      if (!byDate[slot.date]) byDate[slot.date] = [];
      byDate[slot.date].push(slot);
    });
    
    let html = '';
    Object.keys(byDate).sort().forEach(date => {
      html += `<h3 style="margin: 20px 0 10px 0; color: #1a1a2e;">${formatDate(date)}</h3>`;
      html += '<div class="slots-grid">';
      byDate[date].forEach(slot => {
        const status = slot.available ? 'slot-available' : 'slot-booked';
        const style = slot.available ? '' : 'style="background: #e74c3c; color: white; text-decoration: line-through;"';
        html += `<div class="slot ${status}" ${style} onclick="toggleSlot(${slot.id}, ${!slot.available})">${slot.time}</div>`;
      });
      html += '</div>';
    });
    
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<div class="empty-state">Errore: ' + error.message + '</div>';
  }
}

// Toggle slot
async function toggleSlot(slotId, available) {
  try {
    const { error } = await supabase
      .from('slots')
      .update({ available })
      .eq('id', slotId);
    
    if (error) throw error;
    loadSlots();
  } catch (error) {
    console.error('Errore toggle:', error);
  }
}

// Carica appuntamenti
async function loadAppointments() {
  const container = document.getElementById('appointments-container');
  container.innerHTML = '<div class="loading">Caricamento...</div>';
  
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        slots (date, time)
      `)
      .eq('seller_id', currentSeller)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state">Nessun appuntamento prenotato</div>';
      return;
    }
    
    let html = '<div class="appointments-list">';
    data.forEach(apt => {
      html += `
        <div class="appointment">
          <div class="appointment-header">${apt.client_name}</div>
          <div class="appointment-details">
            📅 ${formatDate(apt.slots?.date)} ⏰ ${apt.slots?.time}<br>
            📧 ${apt.client_email}${apt.client_phone ? ' | 📱 ' + apt.client_phone : ''}<br>
            📝 ${apt.notes || 'Nessuna nota'}
          </div>
        </div>
      `;
    });
    html += '</div>';
    
    container.innerHTML = html;
  } catch (error) {
    container.innerHTML = '<div class="empty-state">Errore: ' + error.message + '</div>';
  }
}

// Formatta data
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('it-IT', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'short' 
  });
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
window.login = login;
window.saveConfig = saveConfig;
window.generateSlots = generateSlots;
window.toggleSlot = toggleSlot;

// Inizializza
loadSellers();
