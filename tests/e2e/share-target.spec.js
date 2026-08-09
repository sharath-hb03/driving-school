// Covers /share-target — the endpoint Android's share sheet POSTs a contact to.
//
// Unlike the admin suite this needs no credentials: the handler is deliberately
// auth-free (the share sheet POSTs cross-site, so the SameSite=Lax session
// cookie never arrives) and only redirects to the Leads Hub.
//
// Run against a server serving both the app and the functions:
//   npm run pages:dev
import { test, expect } from '@playwright/test'

// The share sheet sends a file part named `contact`, per the manifest.
function share(request, vcard, filename = 'contact.vcf') {
  return request.post('/share-target', {
    maxRedirects: 0,
    multipart: {
      contact: { name: filename, mimeType: 'text/vcard', buffer: Buffer.from(vcard, 'utf-8') },
    },
  })
}

// Redirect target carries the parsed contact as query params.
function sharedParams(response) {
  expect(response.status()).toBe(303)
  const location = response.headers()['location']
  expect(location).toBeTruthy()
  const url = new URL(location, 'https://example.test')
  expect(url.pathname).toBe('/enquiries')
  return url.searchParams
}

test('vCard 3.0: prefills name and strips the +91 country code', async ({ request }) => {
  const params = sharedParams(await share(request, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Amit Kumar',
    'N:Kumar;Amit;;;',
    'TEL;TYPE=CELL:+91 98765 43210',
    'END:VCARD',
  ].join('\r\n')))

  expect(params.get('shared_name')).toBe('Amit Kumar')
  expect(params.get('shared_phone')).toBe('9876543210')
})

test('prefers the mobile number over a landline', async ({ request }) => {
  const params = sharedParams(await share(request, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Priya Sharma',
    'TEL;TYPE=WORK,VOICE:080-22334455',
    'TEL;TYPE=CELL:9123456780',
    'END:VCARD',
  ].join('\r\n')))

  expect(params.get('shared_phone')).toBe('9123456780')
})

test('vCard 2.1: decodes a quoted-printable name across a folded line', async ({ request }) => {
  const params = sharedParams(await share(request, [
    'BEGIN:VCARD',
    'VERSION:2.1',
    // "अमित कुमार" split with a trailing `=` soft line break, as Android emits.
    'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=E0=A4=95=E0=A5=81=E0=A4=AE=E0=A4=BE=E0=A4=B0;=E0=A4=85=E0=A4=AE=',
    '=E0=A4=BF=E0=A4=A4;;;',
    'TEL;CELL:+919876543210',
    'END:VCARD',
  ].join('\r\n')))

  expect(params.get('shared_name')).toBe('अमित कुमार')
  expect(params.get('shared_phone')).toBe('9876543210')
})

test('falls back to a contact shared as plain text', async ({ request }) => {
  const response = await request.post('/share-target', {
    maxRedirects: 0,
    multipart: { title: 'Ravi Verma', text: 'Ravi Verma\n+91 90000 11111' },
  })
  const params = sharedParams(response)

  expect(params.get('shared_name')).toBe('Ravi Verma')
  expect(params.get('shared_phone')).toBe('9000011111')
})

test('keeps a non-Indian number intact', async ({ request }) => {
  const params = sharedParams(await share(request, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:John Carter',
    'TEL;TYPE=CELL:+1 415 555 0142',
    'END:VCARD',
  ].join('\r\n')))

  expect(params.get('shared_phone')).toBe('+14155550142')
})

test('an unreadable share still opens the Add Lead form', async ({ request }) => {
  const params = sharedParams(await share(request, 'not a vcard at all', 'junk.txt'))

  expect(params.get('shared')).toBe('1')
  expect(params.get('shared_phone')).toBeNull()
})

// The share sheet can fire long after the 30-day session expired. The contact
// has to survive the bounce to /login rather than being lost with the URL.
test('a signed-out share is held for after sign-in', async ({ page }) => {
  await page.goto('/enquiries?shared=1&shared_name=Ravi%20Verma&shared_phone=9000011111')
  await page.waitForURL('**/login')

  const held = await page.evaluate(() => sessionStorage.getItem('instrukt_shared_contact'))
  expect(JSON.parse(held)).toEqual({ name: 'Ravi Verma', phone: '9000011111' })
})

// The payoff: a signed-in user lands on a filled-in form and only has to save.
// Auth is stubbed so this runs without real school accounts. Both staff roles
// are covered — the API middleware admits either, so the share flow must too.
for (const role of ['admin', 'staff']) {
  test(`a shared contact opens Add Lead prefilled for ${role}`, async ({ page }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { user: { id: 'u_1', name: 'Test User', email: 'user@test', role, school_id: 'sch_1', school_name: 'Test School' } },
      })
    )
    await page.route('**/api/enquiries', (route) => route.fulfill({ json: { enquiries: [] } }))

    await page.goto('/enquiries?shared=1&shared_name=Amit%20Kumar&shared_phone=9876543210')

    await expect(page.getByRole('heading', { name: 'Add Walk-in / Phone Lead' })).toBeVisible()
    // Labels aren't linked to their inputs, so locate by placeholder.
    await expect(page.getByPlaceholder('e.g. Amit Kumar')).toHaveValue('Amit Kumar')
    await expect(page.getByPlaceholder('e.g. 9876543210')).toHaveValue('9876543210')

    // The contact is consumed, not left to reappear on the next visit.
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('instrukt_shared_contact'))).toBeNull()
    expect(new URL(page.url()).search).toBe('')
  })
}

// Regression: leads posted by an external landing page arrived as
// source='website', which matched neither tab and hid them from the Leads Hub
// while the dashboard still counted them.
test('a lead with an unrecognised source still shows under Website', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: { user: { id: 'u_1', name: 'Test User', email: 'user@test', role: 'admin', school_id: 'sch_1', school_name: 'Test School' } },
    })
  )
  await page.route('**/api/enquiries', (route) =>
    route.fulfill({
      json: {
        enquiries: [
          { id: 'e_1', name: 'Sharath Hb', phone: '9876543210', source: 'website', status: 'new', created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) },
          { id: 'e_2', name: 'Campaign Lead', phone: '9876543211', source: 'facebook', status: 'new', created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) },
        ],
      },
    })
  )

  await page.goto('/enquiries')
  await page.getByRole('combobox').selectOption('all')

  await expect(page.getByText('Sharath Hb')).toBeVisible()
  await expect(page.getByText('Campaign Lead')).toBeVisible()

  // …and they must not leak into the walk-in tab.
  await page.getByRole('button', { name: 'Walk-in' }).click()
  await expect(page.getByText('Sharath Hb')).toBeHidden()
})

test('the manifest advertises the app as a contact share target', async ({ request }) => {
  const manifest = await (await request.get('/api/manifest')).json()

  expect(manifest.share_target.action).toBe('/share-target')
  expect(manifest.share_target.method).toBe('POST')
  expect(manifest.share_target.enctype).toBe('multipart/form-data')
  expect(manifest.share_target.params.files[0].accept).toContain('text/x-vcard')
})
