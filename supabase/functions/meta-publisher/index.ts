// Meta Publisher - Pubblicazione automatica su Facebook
// Dopo approvazione post dalla dashboard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Configurazione Meta (da variabili d'ambiente)
const META_PAGE_ID = Deno.env.get('META_PAGE_ID') || ''
const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || ''
const META_API_VERSION = 'v18.0'

Deno.serve(async (req) => {
  // Verifica autorizzazione
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${Deno.env.get('PUBLISH_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  try {
    // Trova post approvati ma non ancora pubblicati
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'approved')
      .is('published_at', null)
      .order('approved_at', { ascending: true })
      .limit(1)

    if (error) throw error

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nessun post da pubblicare' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const post = posts[0]

    // Pubblica su Facebook
    const fbResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${META_PAGE_ID}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: post.body + '\n\n' + post.hashtags,
          access_token: META_ACCESS_TOKEN,
          link: post.source_url // Link alla fonte
        })
      }
    )

    const fbResult = await fbResponse.json()

    if (!fbResponse.ok) {
      throw new Error(`Meta API error: ${fbResult.error?.message || 'Unknown'}`)
    }

    // Aggiorna post come pubblicato
    await supabase
      .from('social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_post_id: fbResult.id
      })
      .eq('id', post.id)

    return new Response(
      JSON.stringify({
        success: true,
        post_id: fbResult.id,
        published: true,
        post_title: post.title.substring(0, 50)
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
