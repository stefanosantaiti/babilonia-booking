// Supabase Edge Function - Reminder Automatico Giornaliero
// Schedulato per eseguirsi ogni giorno alle 7:00 UTC

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const TELEGRAM_TOKEN = '8619224941:AAFRV8prDTn58MseqNKKBbEUEBbsNZnu9wk'
const ADMIN_CHAT_ID = '354943189'

Deno.serve(async (req) => {
  // Verifica autorizzazione (puoi chiamare da cron esterno)
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    // Ottieni data di domani
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Trova appuntamenti confermati per domani
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, slots(date, time), sellers(name, email, zoom_link)')
      .eq('slots.date', tomorrowStr)
      .eq('status', 'confirmed')
      .eq('reminder_sent', false)

    if (error) throw error

    let sentCount = 0

    for (const apt of appointments || []) {
      const message = `⏰ **REMINDER DOMANI**

📅 ${apt.slots.date} alle ${apt.slots.time}
👤 ${apt.client_name}
📧 ${apt.client_email}
📱 ${apt.client_phone || 'N/D'}
${apt.telegram ? `💬 Telegram: ${apt.telegram}` : ''}

👨‍💼 Consulente: ${apt.sellers.name}
🔗 Zoom: ${apt.sellers.zoom_link || 'Da definire'}

✅ Conferma: https://stefanosantaiti.github.io/babilonia-landing/manage/?id=${apt.id}`

      try {
        // Invia a admin
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          })
        })

        // Marca come inviato
        await supabase
          .from('appointments')
          .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
          .eq('id', apt.id)

        sentCount++
      } catch (e) {
        console.error('Errore invio:', e)
      }
    }

    return new Response(
      JSON.stringify({ success: true, date: tomorrowStr, reminders_sent: sentCount }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
