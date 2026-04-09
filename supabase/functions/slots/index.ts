// Supabase Edge Function - Booking API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Helper per risposte CORS
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Genera slot per 14 giorni
async function generateSlotsForSeller(supabase: any, sellerId: number, config: any) {
  const slots = []
  const today = new Date()
  
  // Cancella slot futuri esistenti
  const todayStr = today.toISOString().split('T')[0]
  await supabase
    .from('slots')
    .delete()
    .eq('seller_id', sellerId)
    .gte('date', todayStr)
  
  // Giorni settimana: 0=Dom, 1=Lun, ..., 6=Sab
  const availableDays = config.days || [1, 2, 3, 4, 5] // Default: Lun-Ven
  const morningHours = config.morning || ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']
  const afternoonHours = config.afternoon || ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30']
  
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    const dayOfWeek = date.getDay()
    
    // Controlla se il giorno è disponibile
    if (!availableDays.includes(dayOfWeek)) continue
    
    const dateStr = date.toISOString().split('T')[0]
    
    // Aggiungi slot mattina
    morningHours.forEach((time: string) => {
      slots.push({
        id: `${sellerId}_${dateStr}_${time}`,
        seller_id: sellerId,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo'
      })
    })
    
    // Aggiungi slot pomeriggio
    afternoonHours.forEach((time: string) => {
      slots.push({
        id: `${sellerId}_${dateStr}_${time}`,
        seller_id: sellerId,
        date: dateStr,
        time: time,
        available: true,
        type: 'conoscitivo'
      })
    })
  }
  
  if (slots.length > 0) {
    const { error } = await supabase.from('slots').insert(slots)
    return { success: !error, error, count: slots.length }
  }
  
  return { success: true, count: 0 }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }
  
  const url = new URL(req.url)
  const path = url.pathname.replace('/functions/v1/slots', '')
  
  // Crea client Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || 'https://esgjushznmidzdhqsyyx.supabase.co',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
  )
  
  try {
    // GET /sellers - Lista seller
    if (req.method === 'GET' && path.includes('/sellers')) {
      const { data: sellers, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('active', true)
        
      if (error) throw error
      
      return jsonResponse({ success: true, sellers })
    }
    
    // GET /appointments - Lista appuntamenti
    if (req.method === 'GET' && path.includes('/appointments')) {
      const sellerId = url.searchParams.get('seller')
      
      let query = supabase
        .from('appointments')
        .select('*, slots(date, time)')
        .order('created_at', { ascending: false })
        
      if (sellerId) query = query.eq('seller_id', sellerId)
      
      const { data: appointments, error } = await query
      
      if (error) throw error
      
      return jsonResponse({ success: true, appointments })
    }
    
    // GET /slots - Ottieni slot disponibili
    if (req.method === 'GET') {
      const sellerId = url.searchParams.get('seller')
      const date = url.searchParams.get('date')
      
      let query = supabase
        .from('slots')
        .select('*, sellers(name, email)')
        .eq('available', true)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
      
      if (sellerId) query = query.eq('seller_id', sellerId)
      if (date) query = query.eq('date', date)
      
      const { data: slots, error } = await query
      
      if (error) throw error
      
      return jsonResponse({ success: true, slots })
    }
    
    // POST /sellers - Aggiungi seller
    if (req.method === 'POST' && path.includes('/sellers')) {
      const data = await req.json()
      
      const { data: seller, error } = await supabase
        .from('sellers')
        .insert({ name: data.name, email: data.email })
        .select()
        .single()
        
      if (error) throw error
      
      // Genera slot automatici
      await generateSlotsForSeller(supabase, seller.id, {})
      
      return jsonResponse({ success: true, seller })
    }
    
    // POST /slots - Crea appuntamento
    if (req.method === 'POST' && !path.includes('/sellers')) {
      const data = await req.json()
      
      // Verifica slot disponibile
      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('id', data.slotId)
        .eq('available', true)
        .single()
        
      if (slotError || !slot) {
        return jsonResponse({ error: 'Slot not available' }, 400)
      }
      
      // Crea appuntamento
      const appointmentId = `apt_${Date.now()}`
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
        })
        
      if (aptError) throw aptError
      
      // Aggiorna slot
      await supabase
        .from('slots')
        .update({ available: false })
        .eq('id', data.slotId)
      
      return jsonResponse({ 
        success: true, 
        appointmentId,
        message: 'Appuntamento confermato'
      })
    }
    
    // PUT /slots - Aggiorna disponibilità o rigenera
    if (req.method === 'PUT') {
      const data = await req.json()
      
      // Azione: rigenera slot per prossimi 14 giorni
      if (data.action === 'regenerate') {
        const result = await generateSlotsForSeller(supabase, data.sellerId, data.config || {})
        
        if (result.success) {
          return jsonResponse({ 
            success: true, 
            message: `${result.count} slot generati per i prossimi 14 giorni`
          })
        } else {
          return jsonResponse({ 
            success: false, 
            error: 'Errore generazione slot'
          }, 500)
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
            .single()
            
          if (appointment) {
            await supabase
              .from('appointments')
              .update({ status: 'needs_reschedule' })
              .eq('slot_id', data.slotId)
          }
        }
        
        const { error } = await supabase
          .from('slots')
          .update({ available: data.available })
          .eq('id', data.slotId)
          
        if (error) throw error
        
        return jsonResponse({ success: true })
      }
      
      return jsonResponse({ 
        error: 'Invalid request. Use action:regenerate or slotId+available' 
      }, 400)
    }
    
    // DELETE - Cancella appuntamento
    if (req.method === 'DELETE') {
      const data = await req.json()
      
      const { data: appointment } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', data.appointmentId)
        .single()
        
      if (appointment) {
        // Libera slot
        await supabase
          .from('slots')
          .update({ available: true })
          .eq('id', appointment.slot_id)
          
        // Cancella appuntamento
        await supabase
          .from('appointments')
          .delete()
          .eq('id', data.appointmentId)
      }
      
      return jsonResponse({ success: true, message: 'Appuntamento cancellato' })
    }
    
    return jsonResponse({ error: 'Method not allowed' }, 405)
    
  } catch (error) {
    console.error('Error:', error)
    return jsonResponse({ 
      error: 'Internal server error', 
      details: error.message 
    }, 500)
  }
})
