-- Aggiungi campi necessari al database BABILONIA

-- Aggiungi zoom_link alla tabella sellers
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS zoom_link TEXT;

-- Aggiungi telegram alla tabella appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS telegram TEXT;

-- Aggiungi campo per tracciare se reminder è stato inviato
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Commento per documentazione
COMMENT ON COLUMN sellers.zoom_link IS 'Link Zoom ricorrente per il consulente';
COMMENT ON COLUMN appointments.telegram IS 'Username Telegram del cliente per reminder';
COMMENT ON COLUMN appointments.reminder_sent IS 'True se il reminder è stato inviato';
