// End-to-end test for the core school-admin lifecycle:
// login -> enroll a student -> book a class -> record a payment ->
// move the student into the LL test stage & schedule the test -> issue a certificate.
//
// Requires a real school admin account (schools/admins are created via the
// super-admin console, not seeded by the migrations), passed as env vars:
//   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
// Run against a server that serves both the app and the /api functions, e.g.:
//   npm run pages:dev
import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD

test.skip(
  !ADMIN_EMAIL || !ADMIN_PASSWORD,
  'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this suite against a school admin account.'
)

// Field/TextInput/Select render a <label> and its control inside the same
// `div.mb-4` with no htmlFor/id link between them, so locate by structure
// instead of getByLabel.
function fieldControl(scope, labelText) {
  return scope.locator('div.mb-4', { hasText: labelText }).locator('input, select, textarea').first()
}

// The calendar/time-slot popovers (ClassForm's DateTimePicker, the plain
// DatePicker) all render their day grid as `.grid.gap-y-1` and, where a time
// picker follows, its slots as `.grid.max-h-40`. Selecting by index instead
// of a specific date keeps the test correct regardless of when it runs.
async function pickCalendarDay(page, nth = 0) {
  await page.locator('.gap-y-1 > button:not([disabled])').nth(nth).click()
}

async function pickTimeSlot(page) {
  await page.locator('.max-h-40 button:not([disabled])').first().click()
}

test('admin: enroll student, book class, record payment, schedule test, issue certificate', async ({ page }) => {
  const studentName = `E2E Student ${Date.now()}`

  await test.step('Login as school admin', async () => {
    await page.goto('/login')
    await page.getByPlaceholder('you@example.com').fill(ADMIN_EMAIL)
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Accounts tied to a school slug redirect via a full window.location.replace
    // (not an SPA navigate), so wait for that reload to fully settle before
    // driving any further navigation — otherwise it races the next page.goto.
    await page.waitForURL('**/')
    await page.waitForLoadState('networkidle')
  })

  await test.step('Enroll a new student', async () => {
    await page.goto('/students')
    await page.getByRole('button', { name: 'Add student' }).click()
    const modal = page.getByTestId('modal')
    await fieldControl(modal, 'Full name').fill(studentName)
    await fieldControl(modal, 'Phone').fill('9876543210')
    await modal.getByRole('button', { name: 'Add student' }).click()
    await expect(page.getByText('Student added')).toBeVisible()
  })

  await test.step('Open the new student', async () => {
    await page.goto('/students')
    await page.getByPlaceholder('Search by name or phone…').fill(studentName)
    await page.getByText(studentName, { exact: true }).click()
    await expect(page).toHaveURL(/\/students\/.+/)
  })

  await test.step('Book a class', async () => {
    await page.getByRole('button', { name: /^Classes/ }).click()
    await page.getByRole('button', { name: 'Book', exact: true }).click()
    const modal = page.getByTestId('modal')
    // The picker's trigger button shows "Pick a date & time" only when empty —
    // StudentDetail's ClassForm prefills the first slot to "now" by default, so
    // the button already shows a formatted date/time. Locate it structurally
    // (first button in the "Date & time" field) instead of by that text.
    await modal.locator('div.mb-4', { hasText: 'Date & time' }).locator('button').first().click()
    // index 1 (not 0) so the slot always lands in the future, never "today
    // but earlier than now".
    await pickCalendarDay(page, 1)
    await pickTimeSlot(page)
    await modal.getByRole('button', { name: /^Book class/ }).click()
    await expect(page.getByText(/class(es)? booked/i)).toBeVisible()
  })

  await test.step('Record a payment', async () => {
    await page.getByRole('button', { name: /^Payments/ }).click()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const modal = page.getByTestId('modal')
    await fieldControl(modal, 'Amount').fill('2000')
    await modal.getByRole('button', { name: 'Record' }).click()
    await expect(page.getByText('Payment recorded')).toBeVisible()
  })

  await test.step('Move the student into the LL stage and schedule the LL test', async () => {
    await page.goto('/tests?view=stages')
    await page.getByPlaceholder('Search students…').fill(studentName)
    await page.getByRole('button', { name: /^Move to: Learner/ }).click()
    const modal = page.getByTestId('modal')
    await expect(modal.getByRole('heading', { name: 'Schedule LL Test' })).toBeVisible()
    await modal.getByRole('button', { name: 'Select date' }).click()
    await pickCalendarDay(page)
    await modal.getByRole('button', { name: 'Schedule' }).click()
    await expect(page.getByText(/LL Test scheduled/)).toBeVisible()
  })

  await test.step('Issue the certificate', async () => {
    await page.goto('/students')
    await page.getByPlaceholder('Search by name or phone…').fill(studentName)
    await page.getByText(studentName, { exact: true }).click()
    await page.getByRole('button', { name: 'Generate certificate' }).click()
    // Issuing renders a certificate image (Cloudinary round-trip in the
    // background), which is slower than the other steps' toasts.
    await expect(page.getByText('Certificate generated')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/^No\. /)).toBeVisible()
  })
})
