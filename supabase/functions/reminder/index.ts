// Supabase Edge Function - Reminder Appuntamenti
// Da deployare su Supabase per esecuzione automatica

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  const TELEGRAM_TOKEN = '8619224941:AAFRV8prDTn58MseqNKKBbEUEBbsNZnu9wk'
  const TELEGRAM_CHAT = '354943189'

  try {
    // Ottieni data di domani
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Trova appuntamenti per domani confermati
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, slots(date, time), sellers(name, email)')
      .eq('slots.date', tomorrowStr)
      .eq('status', 'confirmed')
      .not('reminder_sent', 'eq', true)

    if (error) throw error

    let sentCount = 0

    for (const apt of appointments) {
      // Costruisci messaggio
      const message = `⏰ **REMINDER DOMANI**

📅 Appuntamento: ${apt.slots.date} alle ${apt.slots.time}
👤 Cliente: ${apt.client_name}
📧 ${apt.client_email}
📱 ${apt.client_phone || 'N/D'}
👨‍💼 Consulente: ${apt.sellers.name}

📎 Link gestione: https://stefanosantaiti.github.io/babilonia-landing/manage/?id=${apt.id}`

      // Invia Telegram al consulente
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT,
            text: message,
            parse_mode: 'Markdown'
          })
        })

        // Invia anche email (se hai server email)
        // await sendEmail(apt.client_email, 'Reminder Appuntamento', emailText)

        // Marca come inviato
        await supabase
          .from('appointments')
          .update({ reminder_sent: true })
          .eq('id', apt.id)

        sentCount++
      } catch (e) {
        console.error('Errore invio reminder:', e)
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sentCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
