// Reads a contact shared from a phone's address book into { name, phone }.
//
// Android contact apps emit vCard 2.1 or 3.0 with quirks a naive split()
// gets wrong: long lines are folded, non-ASCII names arrive quoted-printable
// encoded, and a card usually carries several TEL entries.

// ---------- vCard ----------

// Rebuild logical lines: RFC 6350 folds with a leading space/tab, while
// vCard 2.1 quoted-printable values continue after a trailing `=`.
function unfold(text) {
  const out = []
  for (const line of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const prev = out[out.length - 1]
    if (prev !== undefined && /^[ \t]/.test(line)) {
      out[out.length - 1] = prev + line.slice(1)
    } else if (prev !== undefined && prev.endsWith('=') && /ENCODING=QUOTED-PRINTABLE/i.test(prev)) {
      out[out.length - 1] = prev.slice(0, -1) + line
    } else {
      out.push(line)
    }
  }
  return out
}

// `=E0=A4=95` → the UTF-8 character those bytes spell.
function decodeQuotedPrintable(value) {
  const bytes = []
  for (let i = 0; i < value.length; i++) {
    const hex = value[i] === '=' ? value.slice(i + 1, i + 3) : null
    if (hex && /^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16))
      i += 2
    } else {
      bytes.push(value.charCodeAt(i) & 0xff)
    }
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

const unescapeValue = (v) => v.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c))

function parseLine(line) {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const [rawName, ...params] = line.slice(0, colon).split(';')
  // Property names may carry a grouping prefix, e.g. `item1.TEL`.
  const name = rawName.slice(rawName.indexOf('.') + 1).trim().toUpperCase()
  const flags = params.join(';').toUpperCase()
  let value = line.slice(colon + 1)
  if (/ENCODING=QUOTED-PRINTABLE/i.test(flags)) value = decodeQuotedPrintable(value)
  return { name, flags, value }
}

// N is `Family;Given;Middle;Prefix;Suffix` — reorder it the way a person reads it.
function nameFromN(value) {
  const [family = '', given = '', middle = '', prefix = '', suffix = ''] =
    value.split(';').map((part) => unescapeValue(part).trim())
  return [prefix, given, middle, family, suffix].filter(Boolean).join(' ')
}

// A mobile beats a preferred number, which beats any other line — a lead's
// landline is far less useful to a driving school than the phone they answer.
function telRank(flags) {
  if (/CELL|MOBILE/.test(flags)) return 3
  if (/PREF/.test(flags)) return 2
  if (/VOICE|HOME|WORK/.test(flags)) return 1
  return 0
}

export function parseVCard(text) {
  let fn = ''
  let n = ''
  let phone = ''
  let bestTel = -1

  for (const line of unfold(text || '')) {
    const prop = parseLine(line)
    if (!prop) continue
    // Sharing multiple contacts at once yields several cards; take the first.
    if (prop.name === 'END') break
    if (prop.name === 'FN' && !fn) fn = unescapeValue(prop.value).trim()
    else if (prop.name === 'N' && !n) n = nameFromN(prop.value)
    else if (prop.name === 'TEL') {
      const rank = telRank(prop.flags)
      if (rank > bestTel) {
        bestTel = rank
        phone = unescapeValue(prop.value).trim()
      }
    }
  }

  return { name: fn || n, phone }
}

// ---------- plain text ----------

// Some launchers share a contact as text ("Amit Kumar\n+91 98765 43210")
// rather than as a .vcf attachment.
export function parseSharedText(text) {
  let name = ''
  let phone = ''

  for (const line of String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)) {
    const match = line.match(/\+?\d[\d\s\-().]{7,}/)
    if (!phone && match) {
      phone = match[0]
      continue
    }
    if (!name && !/^https?:/i.test(line)) name = line
  }

  return { name, phone }
}

// ---------- phone ----------

// Reduce to the bare 10-digit form staff type into the Add Lead field, so a
// shared contact reads the same as a hand-entered one (and the existing
// WhatsApp link builder keeps working). Non-Indian numbers keep their prefix.
export function normalizePhone(raw) {
  const hadPlus = String(raw || '').trim().startsWith('+')
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length > 10) return hadPlus ? `+${digits}` : digits
  return digits
}
