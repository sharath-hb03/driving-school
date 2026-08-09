// A contact shared from the phone's address book lands on /enquiries with the
// details in the query string (see functions/share-target.js).
//
// Stash it at boot rather than reading it in the Leads Hub directly: if the
// session has expired, the router bounces to /login before Enquiries ever
// mounts, and the shared contact would be lost.

const KEY = 'instrukt_shared_contact'

export function captureSharedContact() {
  const params = new URLSearchParams(window.location.search)
  if (!params.get('shared')) return

  const contact = {
    name: params.get('shared_name') || '',
    phone: params.get('shared_phone') || '',
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(contact))
  } catch {
    // Private-mode storage failure — the query string below still carries the
    // contact for the common case where the user is already signed in.
    return
  }

  // Drop the details from the address bar so a refresh doesn't re-open the form.
  params.delete('shared')
  params.delete('shared_name')
  params.delete('shared_phone')
  const qs = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
}

export function hasSharedContact() {
  try {
    return sessionStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}

// Reads and clears — a shared contact is handed to the form exactly once.
export function takeSharedContact() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}
