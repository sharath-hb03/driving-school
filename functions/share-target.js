// POST /share-target — where Android's share sheet lands when a contact is
// shared into the installed app (declared as `share_target` in the manifest).
//
// Deliberately auth-free: the share sheet POSTs cross-site, so the SameSite=Lax
// session cookie is not sent and this handler cannot know who is sharing. It
// only reads the payload and bounces to the Leads Hub — the follow-up GET is a
// same-site navigation that *does* carry the session, so the usual authenticated
// flow (and the school scoping that comes with it) takes over from there.
import { parseVCard, parseSharedText, normalizePhone } from './_lib/vcard.js'

const LEADS_PATH = '/enquiries'

export async function onRequestPost({ request }) {
  let name = ''
  let phone = ''

  try {
    const form = await request.formData()

    // `contact` is the param we declare in the manifest; other launchers have
    // been known to use the generic `files`.
    for (const file of [...form.getAll('contact'), ...form.getAll('files')]) {
      if (typeof file?.text !== 'function') continue
      const card = parseVCard(await file.text())
      if (card.phone || card.name) {
        name = card.name
        phone = card.phone
        break
      }
    }

    if (!phone) {
      const text = ['title', 'text', 'url']
        .map((key) => form.get(key))
        .filter((v) => typeof v === 'string')
        .join('\n')
      const shared = parseSharedText(text)
      name = name || shared.name
      phone = shared.phone
    }
  } catch (err) {
    // Never fail the share with an error page — fall through to an empty form,
    // which still beats making the user start from the home screen.
    console.error('[share-target] could not read the shared contact:', err)
  }

  return redirectToLeads(name, phone)
}

// Some launchers re-issue a share as a GET; answer it so the user reaches the
// Add Lead form instead of a 405.
export function onRequestGet({ request }) {
  const params = new URL(request.url).searchParams
  const shared = parseSharedText(['title', 'text', 'url'].map((k) => params.get(k)).filter(Boolean).join('\n'))
  return redirectToLeads(shared.name, shared.phone)
}

function redirectToLeads(name, phone) {
  const params = new URLSearchParams({ shared: '1' })
  const tel = normalizePhone(phone)
  if (name) params.set('shared_name', name)
  if (tel) params.set('shared_phone', tel)

  return new Response(null, {
    status: 303,
    headers: {
      Location: `${LEADS_PATH}?${params}`,
      'Cache-Control': 'no-store',
    },
  })
}
