// API per gestione slot appuntamenti
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join('/tmp', 'booking-db.json');

// Inizializza database se non esiste
function initDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      sellers: {
        stefano: {
          name: "Stefano",
          email: "stefano@example.com",
          slots: generateDefaultSlots(),
          appointments: [],
          pointsThisMonth: 0
        },
        marco: {
          name: "Marco",
          email: "marco@example.com", 
          slots: generateDefaultSlots(),
          appointments: [],
          pointsThisMonth: 0
        }
      },
      settings: {
        appointmentDuration: 15,
        bookingWindowDays: 14,
        reminderHours: 24
      }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

// Genera slot default per 14 giorni
function generateDefaultSlots() {
  const slots = [];
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Orari disponibili (fittizi, modificabili dal consulente)
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
                   '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    
    times.forEach(time => {
      slots.push({
        id: `${dateStr}_${time}`,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo' // 15 min
      });
    });
  }
  
  return slots;
}

// Leggi database
function readDB() {
  initDB();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

// Scrivi database
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const path = event.path.replace('/.netlify/functions/slots', '').replace('/api/slots', '');
  
  try {
    // GET /slots - Ottieni slot disponibili
    if (method === 'GET' && path === '' || path === '/') {
      const db = readDB();
      const sellerId = event.queryStringParameters?.seller;
      const date = event.queryStringParameters?.date;
      
      if (sellerId && db.sellers[sellerId]) {
        let slots = db.sellers[sellerId].slots.filter(s => s.available);
        if (date) {
          slots = slots.filter(s => s.date === date);
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, slots })
        };
      }
      
      // Ritorna tutti i seller con slot disponibili
      const allSlots = {};
      Object.keys(db.sellers).forEach(id => {
        allSlots[id] = {
          name: db.sellers[id].name,
          slots: db.sellers[id].slots.filter(s => s.available)
        };
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, sellers: allSlots })
      };
    }
    
    // POST /slots - Crea appuntamento
    if (method === 'POST') {
      const data = JSON.parse(event.body);
      const { sellerId, slotId, clientName, clientEmail, clientPhone } = data;
      
      const db = readDB();
      const seller = db.sellers[sellerId];
      
      if (!seller) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Seller not found' })
        };
      }
      
      const slot = seller.slots.find(s => s.id === slotId);
      if (!slot || !slot.available) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Slot not available' })
        };
      }
      
      // Crea appuntamento
      const appointment = {
        id: `apt_${Date.now()}`,
        slotId,
        date: slot.date,
        time: slot.time,
        clientName,
        clientEmail,
        clientPhone,
        type: slot.type,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
      
      seller.appointments.push(appointment);
      slot.available = false;
      
      writeDB(db);
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          appointment,
          message: 'Appuntamento confermato'
        })
      };
    }
    
    // PUT /slots - Aggiorna disponibilità (consulente)
    if (method === 'PUT') {
      const data = JSON.parse(event.body);
      const { sellerId, slotId, available, action } = data;
      
      const db = readDB();
      const seller = db.sellers[sellerId];
      
      if (!seller) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Seller not found' })
        };
      }
      
      // Azione: rigenera slot per prossimi 14 giorni
      if (action === 'regenerate') {
        seller.slots = generateDefaultSlots();
        writeDB(db);
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            success: true, 
            message: 'Slot rigenerati per i prossimi 14 giorni'
          })
        };
      }
      
      // Modifica singolo slot
      if (slotId) {
        const slot = seller.slots.find(s => s.id === slotId);
        if (slot) {
          // Se slot diventa non disponibile e c'era appuntamento
          if (!available && !slot.available) {
            const appointment = seller.appointments.find(a => a.slotId === slotId && a.status === 'confirmed');
            if (appointment) {
              // Notifica da implementare
              appointment.status = 'needs_reschedule';
            }
          }
          
          slot.available = available;
          writeDB(db);
          
          return {
            statusCode: 200,
            body: JSON.stringify({ success: true, slot })
          };
        }
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request' })
      };
    }
    
    // DELETE /slots - Cancella appuntamento
    if (method === 'DELETE') {
      const data = JSON.parse(event.body);
      const { sellerId, appointmentId } = data;
      
      const db = readDB();
      const seller = db.sellers[sellerId];
      
      if (!seller) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Seller not found' })
        };
      }
      
      const aptIndex = seller.appointments.findIndex(a => a.id === appointmentId);
      if (aptIndex >= 0) {
        const apt = seller.appointments[aptIndex];
        const slot = seller.slots.find(s => s.id === apt.slotId);
        if (slot) slot.available = true;
        
        seller.appointments.splice(aptIndex, 1);
        writeDB(db);
        
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, message: 'Appuntamento cancellato' })
        };
      }
      
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Appointment not found' })
      };
    }
    
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
