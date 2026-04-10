# Widget Booking Babilonia - Istruzioni Uso

## 🚀 Installazione Rapida

Aggiungi questo codice alla tua landing page:

```html
<!-- 1. Container per il widget -->
<div id="booking-widget"></div>

<!-- 2. Script del widget -->
<script src="https://cdn.jsdelivr.net/gh/stefanosantaiti/babilonia-booking@main/widget/booking-widget.js"></script>

<!-- 3. Inizializza -->
<script>
  // Per Qualifier A (clienti)
  BabiloniaBooking.init(1, 'booking-widget');
  
  // Per Qualifier B (collaboratori)
  // BabiloniaBooking.init(2, 'booking-widget');
</script>
```

## 📝 Posizionamento Suggerito

Aggiungi il container dove vuoi che appaia il calendario:

```html
<section class="booking-section">
  <h2>Prenota il Tuo Appuntamento</h2>
  <p>Seleziona data e orario per una consulenza gratuita</p>
  <div id="booking-widget"></div>
</section>
```

## 🎨 Personalizzazione CSS (Opzionale)

Il widget usa già stili inline. Se vuoi personalizzarlo:

```css
/* Override colori */
.babilonia-widget {
  border-radius: 20px !important;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2) !important;
}

.slot-btn.selected {
  background: #d4af37 !important;
}
```

## 🔧 Test Locale

Per testare in locale prima del deploy:

1. Copia il contenuto di `widget/booking-widget.js`
2. Incollalo in un file `widget.js` locale
3. Cambia lo script src: `<script src="./widget.js"></script>`

## 📱 Responsive

Il widget è responsive di default. Si adatta a:
- Desktop: griglia multi-colonna
- Tablet: 3 colonne
- Mobile: 2 colonne slot

## ✅ URL Funzionali

- **Admin:** `https://stefanosantaiti.github.io/babilonia-booking/admin/`
- **Widget:** `https://cdn.jsdelivr.net/gh/stefanosantaiti/babilonia-booking@main/widget/booking-widget.js`

---

**Nota:** Il widget usa Supabase direttamente dal browser (sicuro, key anon publica).
