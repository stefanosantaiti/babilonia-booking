// API Booking System con Supabase
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://esgjushznmidzdhqsyyx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ2p1c2h6bm1pZHpkaHFzeXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTYwMTcsImV4cCI6MjA5MTIzMjAxN30.cKWfWEkgRTtPKbUduGgNxX6gF18Gqkjg2bWn6twQTbs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Genera slot per 14 giorni
async function generateSlotsForSeller(sellerId) {
  const slots = [];
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    
    const times = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
                   '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    
    times.forEach(time => {
      slots.push({
        id: `${sellerId}_${dateStr}_${time}`,
        seller_id: sellerId,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo'
      });
    });
  }
  
  const { error } = await supabase
    .from('slots')
    .insert(slots);
    
  return !error;
}

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const path = event.path.replace('/.netlify/functions/slots-supabase', '').replace('/api/slots', '');
  
  try {
    // GET /slots - Ottieni slot disponibili
    if (method === 'GET' && (path === '' || path === '/')) {
      const sellerId = event.queryStringParameters?.seller;
      const date = event.queryStringParameters?.date;
      
      let query = supabase
        .from('slots')
        .select('*, sellers(name, email)')
        .eq('available', true);
      
      if (sellerId) query = query.eq('seller_id', sellerId);
      if (date) query = query.eq('date', date);
      
      const { data: slots, error } = await query;
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, slots })
      };
    }
    
    // GET /sellers - Lista seller
    if (method === 'GET' && path === '/sellers') {
      const { data: sellers, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('active', true);
        
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, sellers })
      };
    }
    
    // POST /sellers - Aggiungi seller
    if (method === 'POST' && path === '/sellers') {
      const data = JSON.parse(event.body);
      const { name, email } = data;
      
      const { data: seller, error } = await supabase
        .from('sellers')
        .insert({ name, email })
        .select()
        .single();
        
      if (error) throw error;
      
      // Genera slot automatici
      await generateSlotsForSeller(seller.id);
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, seller })
      };
    }
    
    // POST /slots - Crea appuntamento
    if (method === 'POST' && (path === '' || path === '/')) {
      const data = JSON.parse(event.body);
      const { slotId, clientName, clientEmail, clientPhone } = data;
      
      // Verifica slot disponibile
      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slotId)
        .eq('available', true)
        .single();
        
      if (slotError || !slot) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Slot not available' })
        };
      }
      
      // Crea appuntamento
      const appointmentId = `apt_${Date.now()}`;
      const { error: aptError } = await supabase
        .from('appointments')
        .insert({
          id: appointmentId,
          slot_id: slotId,
          seller_id: slot.seller_id,
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          type: slot.type,
          status: 'confirmed'
        });
        
      if (aptError) throw aptError;
      
      // Aggiorna slot
      const { error: updateError } = await supabase
        .from('slots')
        .update({ available: false })
        .eq('id', slotId);
        
      if (updateError) throw updateError;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          appointmentId,
          message: 'Appuntamento confermato'
        })
      };
    }
    
    // PUT /slots - Aggiorna disponibilità
    if (method === 'PUT') {
      const data = JSON.parse(event.body);
      const { sellerId, slotId, available, action } = data;
      
      if (action === 'regenerate') {
        // Cancella slot vecchi e rigenera
        await supabase
          .from('slots')
          .delete()
          .eq('seller_id', sellerId);
          
        const success = await generateSlotsForSeller(sellerId);
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success, 
            message: 'Slot rigenerati per i prossimi 14 giorni'
          })
        };
      }
      
      if (slotId) {
        // Se rendiamo non disponibile, verifica appuntamenti
        if (!available) {
          const { data: appointment } = await supabase
            .from('appointments')
            .select('*')
            .eq('slot_id', slotId)
            .eq('status', 'confirmed')
            .single();
            
          if (appointment) {
            await supabase
              .from('appointments')
              .update({ status: 'needs_reschedule' })
              .eq('slot_id', slotId);
          }
        }
        
        const { error } = await supabase
          .from('slots')
          .update({ available })
          .eq('id', slotId);
          
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true })
        };
      }
      
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request' })
      };
    }
    
    // GET /appointments - Lista appuntamenti
    if (method === 'GET' && path === '/appointments') {
      const sellerId = event.queryStringParameters?.seller;
      
      let query = supabase
        .from('appointments')
        .select('*, sellers(name, email), slots(date, time)')
        .order('created_at', { ascending: false });
        
      if (sellerId) query = query.eq('seller_id', sellerId);
      
      const { data: appointments, error } = await query;
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, appointments })
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
