#!/bin/bash
# Reminder BABILONIA - Da eseguire via cron alle 7:30
# Uso: curl -H "Authorization: Bearer CRON_SECRET" https://esgjushznmidzdhqsyyx.supabase.co/functions/v1/reminder-daily

# Configurazione
SUPABASE_URL="https://esgjushznmidzdhqsyyx.supabase.co"
FUNCTION_NAME="reminder-daily"
CRON_SECRET="babilonia_reminder_2024"  # Cambia con una chiave sicura

# Esegui funzione
curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}'

echo "Reminder inviato alle $(date)"