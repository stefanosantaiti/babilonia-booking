// Babilonia Booking Widget - Calendario Prenotazione
// Usa Supabase direttamente (no Netlify required)

(function() {
  'use strict';
  
  // Configurazione
  const CONFIG = {
    supabaseUrl: 'https://esgjushznmidzdhqsyyx.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ2p1c2h6bm1pZHpkaHFzeXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTYwMTcsImV4cCI6MjA5MTIzMjAxN30.cKWfWEkgRTtPKbUduGgNxX6gF18Gqkjg2bWn6twQTbs',
    colors: {
      gold: '#d4af37',
      dark: '#1a1a2e',
      white: '#ffffff',
      success: '#2ecc71',
      error: '#e74c3c'
    }
  };

  // Carica Supabase
  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase) {
        resolve(window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey));
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = () => {
        resolve(window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey));
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Stato
  let supabase = null;
  let selectedSlot = null;
  let currentSeller = null;

  // Inizializza widget
  async function initBookingWidget(sellerId, containerId) {
    currentSeller = sellerId;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error('Container non trovato:', containerId);
      return;
    }
    
    try {
      supabase = await loadSupabase();
      renderWidget(container);
      await loadAvailableSlots();
    } catch (error) {
      container.innerHTML = '<p style="color: ' + CONFIG.colors.error + '">Errore caricamento. Riprova.</p>';
    }
  }

  // Renderizza widget
  function renderWidget(container) {
    container.innerHTML = `
      <style>
        .babilonia-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 500px;
          margin: 0 auto;
          background: ${CONFIG.colors.white};
          border-radius: 16px;
          padding: 25px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        }
        .babilonia-widget h3 {
          color: ${CONFIG.colors.dark};
          margin-bottom: 20px;
          text-align: center;
          font-size: 1.4rem;
        }
        .date-selector {
          margin-bottom: 20px;
        }
        .date-selector label {
          display: block;
          margin-bottom: 8px;
          color: ${CONFIG.colors.dark};
          font-weight: 500;
        }
        .date-selector input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
        }
        .slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 8px;
          margin: 15px 0;
        }
        .slot-btn {
          padding: 10px;
          border: 2px solid ${CONFIG.colors.gold};
          background: ${CONFIG.colors.white};
          color: ${CONFIG.colors.dark};
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }
        .slot-btn:hover:not(:disabled) {
          background: ${CONFIG.colors.gold};
          color: ${CONFIG.colors.white};
        }
        .slot-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          border-color: #ccc;
        }
        .slot-btn.selected {
          background: ${CONFIG.colors.gold};
          color: ${CONFIG.colors.white};
        }
        .booking-form {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #eee;
        }
        .booking-form input,
        .booking-form textarea {
          width: 100%;
          padding: 12px;
          margin-bottom: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
          font-family: inherit;
        }
        .booking-form button {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, ${CONFIG.colors.gold} 0%, #c5a028 100%);
          color: ${CONFIG.colors.white};
          border: none;
          border-radius: 8px;
          font-size: 1.1rem;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .booking-form button:hover {
          transform: translateY(-2px);
        }
        .booking-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .message {
          padding: 12px;
          border-radius: 8px;
          margin: 10px 0;
          text-align: center;
        }
        .message.success {
          background: #d4edda;
          color: #155724;
        }
        .message.error {
          background: #f8d7da;
          color: #721c24;
        }
        .loading {
          text-align: center;
          color: #888;
          padding: 20px;
        }
      </style>
      
      <div class="babilonia-widget">
        <h3>📅 Prenota il Tuo Appuntamento</h3>
        
        <div class="date-selector">
          <label>Seleziona Data:</label>
          <input type="date" id="date-picker" min="${getToday()}" onchange="onDateChange()">
        </div>
        
        <div id="slots-container" class="loading">
          Seleziona una data per vedere gli orari disponibili
        </div>
        
        <div id="booking-form" class="booking-form" style="display: none;">
          <h4 style="margin-bottom: 15px; color: ${CONFIG.colors.dark};">
            Appuntamento: <span id="selected-datetime"></span>
          </h4>
          <input type="text" id="client-name" placeholder="Nome e Cognome *" required>
          <input type="email" id="client-email" placeholder="Email *" required>
          <input type="tel" id="client-phone" placeholder="Telefono">
          <textarea id="client-notes" placeholder="Note (opzionale)" rows="3"></textarea>
          <button onclick="submitBooking()">Conferma Prenotazione</button>
        </div>
        
        <div id="message-container"></div>
      </div>
    `;
  }

  // Utility: data odierna
  function getToday() {
    return new Date().toISOString().split('T')[0];
  }

  // Carica slot disponibili
  async function loadAvailableSlots() {
    const datePicker = document.getElementById('date-picker');
    const selectedDate = datePicker.value || getToday();
    
    const container = document.getElementById('slots-container');
    container.innerHTML = '<div class="loading">Caricamento orari...</div>';
    
    try {
      const { data, error } = await supabase
        .from('slots')
        .select('*')
        .eq('seller_id', currentSeller)
        .eq('date', selectedDate)
        .eq('available', true)
        .order('time');
      
      if (error) throw error;
      
      if (data.length === 0) {
        container.innerHTML = '<div class="loading">Nessuno slot disponibile per questa data. Prova un altro giorno.</div>';
        return;
      }
      
      let html = '<div class="slots-grid">';
      data.forEach(slot => {
        html += `<button class="slot-btn" onclick="selectSlot('${slot.id}', '${slot.date}', '${slot.time}')">${slot.time}</button>`;
      });
      html += '</div>';
      container.innerHTML = html;
      
    } catch (error) {
      container.innerHTML = '<div class="loading" style="color: ' + CONFIG.colors.error + '">Errore caricamento. Riprova.</div>';
    }
  }

  // Seleziona slot
  function selectSlot(slotId, date, time) {
    selectedSlot = { id: slotId, date, time };
    
    // Aggiorna UI
    document.querySelectorAll('.slot-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    event.target.classList.add('selected');
    
    // Mostra form
    const form = document.getElementById('booking-form');
    form.style.display = 'block';
    document.getElementById('selected-datetime').textContent = 
      new Date(date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) + ' alle ' + time;
    
    // Scroll al form
    form.scrollIntoView({ behavior: 'smooth' });
  }

  // Submit prenotazione
  async function submitBooking() {
    if (!selectedSlot) return;
    
    const name = document.getElementById('client-name').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const notes = document.getElementById('client-notes').value.trim();
    
    if (!name || !email) {
      showMessage('Inserisci nome e email', false);
      return;
    }
    
    const btn = document.querySelector('#booking-form button');
    btn.disabled = true;
    btn.textContent = 'Conferma in corso...';
    
    try {
      // Crea appuntamento
      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .insert({
          slot_id: selectedSlot.id,
          seller_id: currentSeller,
          client_name: name,
          client_email: email,
          client_phone: phone,
          notes: notes,
          status: 'confirmed'
        })
        .select()
        .single();
      
      if (aptError) throw aptError;
      
      // Aggiorna slot
      await supabase
        .from('slots')
        .update({ available: false })
        .eq('id', selectedSlot.id);
      
      // Messaggio successo
      showMessage(`✅ Prenotazione confermata! Riceverai una email di conferma.`, true);
      
      // Reset
      document.getElementById('booking-form').style.display = 'none';
      document.getElementById('client-name').value = '';
      document.getElementById('client-email').value = '';
      document.getElementById('client-phone').value = '';
      document.getElementById('client-notes').value = '';
      selectedSlot = null;
      
      // Ricarica slot
      await loadAvailableSlots();
      
    } catch (error) {
      showMessage('Errore: ' + error.message, false);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Conferma Prenotazione';
    }
  }

  // Mostra messaggio
  function showMessage(text, isSuccess) {
    const container = document.getElementById('message-container');
    container.innerHTML = `<div class="message ${isSuccess ? 'success' : 'error'}">${text}</div>`;
    setTimeout(() => container.innerHTML = '', 5000);
  }

  // Gestione cambio data
  function onDateChange() {
    loadAvailableSlots();
  }

  // Esporta globalmente
  window.BabiloniaBooking = {
    init: initBookingWidget,
    refresh: loadAvailableSlots
  };

})();
