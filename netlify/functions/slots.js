// API Booking System con Supabase
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://esgjushznmidzdhqsyyx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Genera slot per 14 giorni
async function generateSlotsForSeller(sellerId) {
  const slots = [];
  const today = new Date();
  
  // Prima cancella slot esistenti futuri
  const todayStr = today.toISOString().split('T')[0];
  await supabase
    .from('slots')
    .delete()
    .eq('seller_id', sellerId)
    .gte('date', todayStr);
  
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
  
  const { error } = await supabase.from('slots').insert(slots);
  return { success: !error, error };
}

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const path = event.path || '';
  
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // Handle OPTIONS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    // GET /slots/sellers - Lista seller
    if (method === 'GET' && path.includes('/sellers')) {
      const { data: sellers, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('active', true);
        
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, sellers })
      };
    }
    
    // GET /slots/appointments - Lista appuntamenti
    if (method === 'GET' && path.includes('/appointments')) {
      const sellerId = event.queryStringParameters?.seller;
      
      let query = supabase
        .from('appointments')
        .select('*, slots(date, time)')
        .order('created_at', { ascending: false });
        
      if (sellerId) query = query.eq('seller_id', sellerId);
      
      const { data: appointments, error } = await query;
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, appointments })
      };
    }
    
    // GET /slots - Ottieni slot disponibili
    if (method === 'GET') {
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
        headers,
        body: JSON.stringify({ success: true, slots })
      };
    }
    
    // POST /sellers - Aggiungi seller
    if (method === 'POST' && path.includes('/sellers')) {
      const data = JSON.parse(event.body);
      
      const { data: seller, error } = await supabase
        .from('sellers')
        .insert({ name: data.name, email: data.email })
        .select()
        .single();
        
      if (error) throw error;
      
      // Genera slot automatici
      await generateSlotsForSeller(seller.id);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, seller })
      };
    }
    
    // POST /slots - Crea appuntamento
    if (method === 'POST') {
      const data = JSON.parse(event.body);
      
      // Verifica slot disponibile
      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('id', data.slotId)
        .eq('available', true)
        .single();
        
      if (slotError || !slot) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Slot not available' })
        };
      }
      
      // Crea appuntamento
      const appointmentId = `apt_${Date.now()}`;
      const { error: aptError } = await supabase
        .from('appointments')
        .insert({
          id: appointmentId,
          slot_id: data.slotId,
          seller_id: slot.seller_id,
          client_name: data.clientName,
          client_email: data.clientEmail,
          client_phone: data.clientPhone,
          type: slot.type,
          status: 'confirmed'
        });
        
      if (aptError) throw aptError;
      
      // Aggiorna slot
      await supabase
        .from('slots')
        .update({ available: false })
        .eq('id', data.slotId);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          appointmentId,
          message: 'Appuntamento confermato'
        })
      };
    }
    
    // PUT /slots - Aggiorna disponibilità o rigenera
    if (method === 'PUT') {
      const data = JSON.parse(event.body);
      
      // Azione: rigenera slot per prossimi 14 giorni
      if (data.action === 'regenerate') {
        const result = await generateSlotsForSeller(data.sellerId);
        
        if (result.success) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true, 
              message: 'Slot rigenerati per i prossimi 14 giorni'
            })
          };
        } else {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              success: false, 
              error: 'Errore generazione slot'
            })
          };
        }
      }
      
      // Modifica singolo slot
      if (data.slotId && data.available !== undefined) {
        // Se rendiamo non disponibile, verifica appuntamenti
        if (!data.available) {
          const { data: appointment } = await supabase
            .from('appointments')
            .select('*')
            .eq('slot_id', data.slotId)
            .eq('status', 'confirmed')
            .single();
            
          if (appointment) {
            await supabase
              .from('appointments')
              .update({ status: 'needs_reschedule' })
              .eq('slot_id', data.slotId);
          }
        }
        
        const { error } = await supabase
          .from('slots')
          .update({ available: data.available })
          .eq('id', data.slotId);
          
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request. Use action:regenerate or slotId+available' })
      };
    }
    
    // DELETE /slots - Cancella appuntamento
    if (method === 'DELETE') {
      const data = JSON.parse(event.body);
      
      const { data: appointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', data.appointmentId)
        .single();
        
      if (appointment) {
        // Libera slot
        await supabase
          .from('slots')
          .update({ available: true })
          .eq('id', appointment.slot_id);
          
        // Cancella appuntamento
        await supabase
          .from('appointments')
          .delete()
          .eq('id', data.appointmentId);
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Appuntamento cancellato' })
      };
    }
    
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed', method, path })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
