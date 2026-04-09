#!/bin/bash
# Cron job per reminder BABILONIA
# Esegui: 0 7 * * * /root/.openclaw/workspace/babilonia-booking-git/scripts/run-reminder.sh

cd /root/.openclaw/workspace/babilonia-booking-git

# Richiede SUPABASE_SERVICE_KEY
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "ERRORE: Variabile SUPABASE_SERVICE_KEY non impostata"
    echo "Ottieni la service key da: https://app.supabase.com/project/_/settings/api"
    exit 1
fi

node scripts/reminder-cron.js