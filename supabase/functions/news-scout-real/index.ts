// News Scout PRO - RSS Reali con Supabase Edge Function
// Fetch news da fonti italiane vere, con scoring e storage

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Fonti RSS affidabili (italiane e internazionali)
const RSS_SOURCES = [
  {
    name: "Il Sole 24 Ore - Economia",
    url: "https://www.ilsole24ore.com/rss/economia.xml",
    weight: 9,
    category: "economia"
  },
  {
    name: "Il Sole 24 Ore - Risparmio",
    url: "https://www.ilsole24ore.com/rss/risparmio.xml",
    weight: 10,
    category: "risparmio"
  },
  {
    name: "Ansa - Economia",
    url: "https://www.ansa.it/economia/rss.xml",
    weight: 7,
    category: "economia"
  },
  {
    name: "Bloomberg - Markets",
    url: "https://feeds.bloomberg.com/markets/news.rss",
    weight: 8,
    category: "markets"
  }
];

// Keywords pesate per scoring
const KEYWORD_SCORES: Record<string, number> = {
  "oro": 10,
  "gold": 9,
  "oro record": 10,
  "prezzo oro": 9,
  "pensione": 9,
  "pensioni": 9,
  "quota 100": 8,
  "inflazione": 9,
  "inflazione record": 10,
  "BCE": 7,
  "tassi": 8,
  "tassi BCE": 9,
  "risparmio": 8,
  "risparmiatori": 8,
  "investimenti": 7,
  "crisi bancaria": 9,
  "fondi pensione": 8
};

// Template post
const TEMPLATES = {
  oro: {
    intro: ["🏆 Oro: nuovo record storico", "📈 Mai così alto: l'oro batte ogni previsione", "💰 Oro in rally"],
    body: "Il prezzo dell'oro ha toccato livelli mai visti prima. Non è un caso: dietro questo rialzo ci sono fattori strutturali che chi possiede risparmi non può ignorare.",
    cta: "Vuoi capire cosa significa per i tuoi risparmi? Scrivimi."
  },
  inflazione: {
    intro: ["📉 Il caro vita che nessuno racconta", "💸 Così l'inflazione erode i risparmi", "⚠️ Inflazione sopra il target"],
    body: "L'inflazione resta sopra al 2% target della BCE. Per chi ha i soldi fermi in banca, questo significa una perdita silenziosa ma costante del potere d'acquisto.",
    cta: "Ci sono strumenti per difendersi. Ne parliamo?"
  },
  pensione: {
    intro: ["⏰ Per la pensione, oggi conta più di ieri", "🎯 Pensione: le scelte che cambiano tutto", "📋 Pensioni, cosa sta cambiando"],
    body: "Chi si avvicina alla pensione oggi affronta un dilemma: aspettare l'età standard o valutare alternative che garantiscano serenità economica prima?",
    cta: "Il tempo è un fattore decisivo. Valutiamo insieme."
  },
  tassi: {
    intro: ["🏛️ Tassi BCE: la decisione che influisce su tutti", "📈 Tassi su o giù: perché importa"],
    body: "La Banca Centrale Europea ha deciso. I tassi d'interesse influenzano mutui, prestiti, ma anche e soprattutto il rendimento di ogni forma di risparmio.",
    cta: "Ci sono scelte intelligenti anche in questo scenario."
  },
  default: {
    intro: ["📊 Un aggiornamento importante", "💡 Ho letto qualcosa che ti interessa"],
    body: "Le notizie di oggi confermano quanto sia importante fare scelte consapevoli sui propri risparmi.",
    cta: "Parliamone senza impegno."
  }
};

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  );

  try {
    const today = new Date().toISOString().split('T')[0];
    const results = [];

    // Fetch ogni fonte RSS
    for (const source of RSS_SOURCES) {
      try {
        console.log(`Fetching: ${source.name}`);
        
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BABILONIA NewsBot/1.0)'
          }
        });
        
        if (!response.ok) {
          console.log(`Skip ${source.name}: ${response.status}`);
          continue;
        }
        
        const xml = await response.text();
        
        // Parse semplice RSS (senza librerie esterne)
        const items = parseRSSItems(xml);
        
        // Prendi solo le prime 3 notizie per fonte
        for (const item of items.slice(0, 3)) {
          const score = calculateScore(item, source);
          
          if (score.total >= 7.0) {
            // Genera post
            const post = generatePost(item, source, score);
            
            // Salva in Supabase
            const { data, error } = await supabase
              .from('social_posts')
              .insert({
                title: item.title,
                body: post.body,
                hashtags: post.hashtags,
                source: source.name,
                source_url: item.link,
                pub_date: item.pubDate || today,
                pub_time: item.pubTime || new Date().toTimeString().slice(0,5),
                relevance_score: score.total,
                keywords_matched: score.keywords,
                template_used: post.template,
                status: 'pending_approval',
                created_at: new Date().toISOString()
              })
              .select();
            
            if (!error && data) {
              results.push(data[0]);
            }
          }
        }
        
      } catch (err) {
        console.error(`Errore ${source.name}:`, err.message);
      }
    }

    // Mantieni solo i 3 migliori post
    results.sort((a, b) => b.relevance_score - a.relevance_score);
    const topPosts = results.slice(0, 3);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        posts_found: results.length,
        posts_saved: topPosts.length,
        posts: topPosts
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// Parse RSS senza dipendenze esterne
function parseRSSItems(xml: string) {
  const items: any[] = [];
  
  // Estrai item con regex
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    
    const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || '';
    const description = itemXml.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() || '';
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    
    // Converte pubDate in formato ISO
    const date = pubDate ? new Date(pubDate).toISOString().split('T')[0] : '';
    const time = pubDate ? new Date(pubDate).toTimeString().slice(0,5) : '';
    
    if (title) {
      items.push({ title, link, description, pubDate: date, pubTime: time });
    }
  }
  
  return items;
}

// Calcola score notizia
function calculateScore(item: any, source: any) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  let score = source.weight * 0.4; // Base dalla fonte
  const keywords: string[] = [];
  
  for (const [kw, weight] of Object.entries(KEYWORD_SCORES)) {
    if (text.includes(kw.toLowerCase())) {
      score += weight * 0.5;
      keywords.push(kw);
    }
  }
  
  // Bonus orari recenti
  const itemDate = new Date(item.pubDate);
  const hoursAgo = (Date.now() - itemDate.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 6) score += 1.5; // Meno di 6 ore
  else if (hoursAgo < 24) score += 0.5; // Meno di 24 ore
  
  return {
    total: Math.min(10, Math.round(score * 10) / 10),
    keywords: keywords.slice(0, 5) // Max 5 keywords
  };
}

// Genera post da template
function generatePost(item: any, source: any, score: any) {
  const titleLower = item.title.toLowerCase();
  let templateKey = 'default';
  
  if (titleLower.includes('oro')) templateKey = 'oro';
  else if (titleLower.includes('inflazione')) templateKey = 'inflazione';
  else if (titleLower.includes('pensione')) templateKey = 'pensione';
  else if (titleLower.includes('tassi') || titleLower.includes('bce')) templateKey = 'tassi';
  
  const template = TEMPLATES[templateKey as keyof typeof TEMPLATES] || TEMPLATES.default;
  const intro = template.intro[Math.floor(Math.random() * template.intro.length)];
  
  const body = `${intro}\n\n${template.body}\n\n${item.description?.substring(0, 120)}...\n\nLe opportunità esistono. Serve solo riconoscerle.\n\n${template.cta}`;
  
  const hashtags = '#oro #investimenti #risparmio ' + score.keywords.slice(0, 3).map((k: string) => '#' + k.replace(/\s+/g, '')).join(' ');
  
  return { body, hashtags, template: templateKey };
}
