// API Booking System con Supabase
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://esgjushznmidzdhqsyyx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

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
  
  const { error } = await supabase.from('slots').insert(slots);
  return !error;
}

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const path = event.path.replace('/.netlify/functions/slots', '').replace('/api/slots', '');
  
  try {
    // GET /sellers - Lista seller
    if (method === 'GET' && path === '/sellers') {
      const { data: sellers, error } = await supabase.from('sellers').select('*').eq('active', true);
      if (error) throw error;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, sellers }) };
    }
    
    // GET /slots - Ottieni slot disponibili
    if (method === 'GET' && (path === '' || path === '/')) {
      const sellerId = event.queryStringParameters?.seller;
      let query = supabase.from('slots').select('*, sellers(name, email)').eq('available', true);
      if (sellerId) query = query.eq('seller_id', sellerId);
      const { data: slots, error } = await query;
      if (error) throw error;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, slots }) };
    }
    
    // POST /sellers - Aggiungi seller
    if (method === 'POST' && path === '/sellers') {
      const data = JSON.parse(event.body);
      const { data: seller, error } = await supabase.from('sellers').insert({ name: data.name, email: data.email }).select().single();
      if (error) throw error;
      await generateSlotsForSeller(seller.id);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, seller }) };
    }
    
    // POST /slots - Crea appuntamento
    if (method === 'POST' && (path === '' || path === '/')) {
      const data = JSON.parse(event.body);
      const { data: slot, error: slotError } = await supabase.from('slots').select('*').eq('id', data.slotId).eq('available', true).single();
      if (slotError || !slot) return { statusCode: 400, body: JSON.stringify({ error: 'Slot not available' }) };
      
      const appointmentId = `apt_${Date.now()}`;
      await supabase.from('appointments').insert({
        id: appointmentId,
        slot_id: data.slotId,
        seller_id: slot.seller_id,
        client_name: data.clientName,
        client_email: data.clientEmail,
        client_phone: data.clientPhone,
        type: slot.type,
        status: 'confirmed'
      });
      await supabase.from('slots').update({ available: false }).eq('id', data.slotId);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, appointmentId, message: 'Appuntamento confermato' }) };
    }
    
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
