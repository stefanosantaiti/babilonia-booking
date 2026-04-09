// Reminder Giornaliero - 7:30
// Invia UN riepilogo per consulente con tutti i suoi appuntamenti della giornata

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const TELEGRAM_TOKEN = '8619224941:AAFRV8prDTn58MseqNKKBbEUEBbsNZnu9wk'
const ADMIN_CHAT_ID = '354943189'

// Configura Resend per email (GRATIS fino a 3000 email/mese)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    // Ottieni data di oggi
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Trova TUTTI i consulenti attivi
    const { data: sellers, error: sellersError } = await supabase
      .from('sellers')
      .select('id, name, email, zoom_link')
      .eq('active', true)

    if (sellersError) throw sellersError

    // Trova appuntamenti confermati per oggi
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, slots(date, time)')
      .eq('slots.date', todayStr)
      .eq('status', 'confirmed')
      .eq('reminder_sent', false)

    if (error) throw error

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nessun appuntamento da notificare oggi' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Raggruppa appuntamenti per consulente
    const appointmentsBySeller: Record<number, any[]> = {}
    for (const apt of appointments) {
      if (!appointmentsBySeller[apt.seller_id]) {
        appointmentsBySeller[apt.seller_id] = []
      }
      appointmentsBySeller[apt.seller_id].push(apt)
    }

    let sentCount = 0

    // Per ogni consulente con appuntamenti
    for (const seller of sellers || []) {
      const sellerAppointments = appointmentsBySeller[seller.id]
      
      if (!sellerAppointments || sellerAppointments.length === 0) {
        continue // Nessun appuntamento oggi per questo consulente
      }

      // Ordina per ora
      sellerAppointments.sort((a, b) => a.slots.time.localeCompare(b.slots.time))

      // ========== 1. TELEGRAM AL CONSULENTE ==========
      let telegramMsg = `⏰ **RIEPILOGO APPUNTAMENTI OGGI (${todayStr})**

👨‍💼 Consulente: ${seller.name}
📊 Totale: ${sellerAppointments.length} appuntamento/i

═══════════════════\n\n`

      for (const apt of sellerAppointments) {
        telegramMsg += `🕐 **${apt.slots.time}**
👤 ${apt.client_name}
📧 ${apt.client_email}
📱 ${apt.client_phone || 'N/D'}
${apt.telegram ? `💬 Telegram: @${apt.telegram.replace('@', '')}` : ''}
🔗 Zoom: ${seller.zoom_link || 'Da definire'}
✅ Gestisci: /manage/?id=${apt.id}

`
      }

      // Invia a te (admin) per ora - poi possiamo configurare chat_id per ogni consulente
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: telegramMsg,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          })
        })
      } catch (e) {
        console.error('Errore Telegram:', e)
      }

      // ========== 2. EMAIL AL CONSULENTE ==========
      if (RESEND_API_KEY && seller.email) {
        let emailHtml = `
          <h2>Riepilogo Appuntamenti Oggi - ${todayStr}</h2>
          <p><strong>Consulente:</strong> ${seller.name}</p>
          <p><strong>Totale:</strong> ${sellerAppointments.length} appuntamento/i</p>
          <hr>
        `

        for (const apt of sellerAppointments) {
          emailHtml += `
            <div style="margin: 20px 0; padding: 15px; border-left: 4px solid #d4af37; background: #f9f9f9;">
              <h3>🕐 ${apt.slots.time}</h3>
              <p><strong>Cliente:</strong> ${apt.client_name}</p>
              <p><strong>Email:</strong> ${apt.client_email}</p>
              <p><strong>Telefono:</strong> ${apt.client_phone || 'N/D'}</p>
              ${apt.telegram ? `<p><strong>Telegram:</strong> ${apt.telegram}</p>` : ''}
              <p><strong>Link Zoom:</strong> <a href="${seller.zoom_link || '#'}">${seller.zoom_link || 'Da definire'}</a></p>
              <p><a href="https://stefanosantaiti.github.io/babilonia-landing/manage/?id=${apt.id}">Gestisci Appuntamento</a></p>
            </div>
          `
        }

        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: 'BABILONIA <reminder@babilonia.app>',
              to: seller.email,
              subject: `⏰ Riepilogo Appuntamenti Oggi - ${seller.name} (${sellerAppointments.length})`,
              html: emailHtml
            })
          })
        } catch (e) {
          console.error('Errore email:', e)
        }
      }

      // Marca tutti gli appuntamenti come inviati
      for (const apt of sellerAppointments) {
        await supabase
          .from('appointments')
          .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
          .eq('id', apt.id)
      }

      sentCount += sellerAppointments.length
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: todayStr, 
        reminders_sent: sentCount,
        consultants_notified: Object.keys(appointmentsBySeller).length,
        time: '07:30'
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
