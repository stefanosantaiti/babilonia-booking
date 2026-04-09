// Reminder Automatico - Telegram & Email
// Esegui ogni giorno alle 7:00 (prima degli appuntamenti)

const SUPABASE_URL = 'https://esgjushznmidzdhqsyyx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Richiede service key
const TELEGRAM_TOKEN = '8619224941:AAFRV8prDTn58MseqNKKBbEUEBbsNZnu9wk';

async function sendReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`Invio reminder per ${tomorrowStr}`);

  // Trova appuntamenti domani confermati senza reminder
  const { data: appointments, error } = await fetch(
    `${SUPABASE_URL}/rest/v1/appointments?slots.date=eq.${tomorrowStr}&status=eq.confirmed&reminder_sent=eq.false&select=*,slots(*),sellers(*)`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }
  ).then(r => r.json());

  if (error || !appointments || appointments.length === 0) {
    console.log('Nessun appuntamento da notificare');
    return;
  }

  for (const apt of appointments) {
    const message = `⏰ **REMINDER DOMANI**

📅 ${apt.slots.date} alle ${apt.slots.time}
👤 ${apt.client_name}
📧 ${apt.client_email}
${apt.telegram ? `💬 Telegram: ${apt.telegram}` : ''}

👨‍💼 Consulente: ${apt.sellers.name}
🔗 Zoom: ${apt.sellers.zoom_link || 'Da definire'}

✅ Conferma: /manage/?id=${apt.id}`;

    // Invia a te (354943189)
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: '354943189',
          text: message,
          parse_mode: 'Markdown'
        })
      });
      console.log(`Reminder inviato per ${apt.client_name}`);

      // Invia anche al cliente se ha Telegram
      if (apt.telegram) {
        const clientMsg = `⏰ **REMINDER APPUNTAMENTO**

Ciao ${apt.client_name},

Ti ricordiamo del tuo appuntamento di domani:
📅 ${apt.slots.date} alle ${apt.slots.time}
👨‍💼 Con: ${apt.sellers.name}

🔗 Link Zoom: ${apt.sellers.zoom_link || 'Ti verrà inviato prima del colloquio'}

Gestisci: /manage/?id=${apt.id}`;

        // Nota: serve chat_id del cliente, non solo username
        // Per ora inviamo solo a te
      }

      // Marca come inviato
      await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${apt.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reminder_sent: true })
      });

    } catch (e) {
      console.error('Errore invio:', e);
    }
  }
}

sendReminders();
