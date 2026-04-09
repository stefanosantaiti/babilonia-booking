# Guida Deploy Babilonia Booking su Netlify

## 📋 Prerequisiti

- Account Netlify (gratuito su https://app.netlify.com)
- Repository GitHub `stefanosantaiti/babilonia-booking` (già esistente)
- ~5 minuti di tempo

---

## 🚀 Step 1: Connetti Repository

1. Vai su https://app.netlify.com
2. Clicca **"Add new site"** → **"Import an existing project"**
3. Seleziona **GitHub** come provider
4. Autorizza Netlify ad accedere ai tuoi repo
5. Trova e seleziona `stefanosantaiti/babilonia-booking`

---

## ⚙️ Step 2: Configura Build Settings

Nella schermata di deploy, inserisci:

| Campo | Valore |
|-------|--------|
| **Build command** | *(lascia vuoto)* |
| **Publish directory** | `.` |
| **Node version** | `18` *(in variabili ambiente)* |

Clicca **"Deploy site"**

---

## 🔐 Step 3: Aggiungi Variabili d'Ambiente

1. Vai su **Site settings** → **Environment variables**
2. Clicca **"Add variable"** → **"Add single variable"**
3. Aggiungi:

```
Key: SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzZ2p1c2h6bm1pZHpkaHFzeXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTYwMTcsImV4cCI6MjA5MTIzMjAxN30.cKWfWEkgRTtPKbUduGgNxX6gF18Gqkjg2bWn6twQTbs
```

4. Clicca **Save**

---

## 🔄 Step 4: Trigger Deploy

1. Vai su **Deploys**
2. Clicca **"Trigger deploy"** → **"Deploy site"**
3. Attendi ~1-2 minuti

---

## ✅ Step 5: Verifica

1. Clicca sul link del sito (es. `https://babilonia-booking-xxx.netlify.app`)
2. Testa le API:
   ```
   https://TUO-SITO.netlify.app/api/slots?seller=1
   ```
3. Dovresti vedere i slot in JSON

---

## 🔗 Step 6: Configura Dominio (Opzionale)

1. Vai su **Domain settings**
2. Clicca **"Add custom domain"**
3. Inserisci: `babiloniabooking.netlify.app` (o il tuo dominio)

---

## 📁 File Importanti nel Repo

```
babilonia-booking/
├── netlify/
│   └── functions/
│       └── slots-supabase.js    ← API principale
├── admin/
│   └── index.html                ← Interfaccia admin
├── netlify.toml                  ← Configurazione build
└── package.json                  ← Dipendenze
```

---

## 🐛 Troubleshooting

### "Function not found"
→ Ricontrolla che `netlify/functions/` esista

### "SUPABASE_ANON_KEY not set"
→ Verifica variabile d'ambiente nelle impostazioni

### Build fallita
→ Assicurati che Build command sia vuoto e Publish directory sia `.`

---

## 📞 Dopo il Deploy

Una volta deployato, aggiorna l'URL nell'admin:

File: `admin/index.html` riga ~30
```javascript
const API_BASE = 'https://TUO-SITO.netlify.app/api';
```

Sostituisci con il tuo URL reale.

---

**Deploy completato!** 🎉
