// Shared config for student DL/LL documents + the Learner's Licence application profile.
// Used by the student portal (upload/edit) and the admin/staff student page (view).
import { IdCard, Image, PenLine, Home, CalendarClock, ShieldCheck, Car, FileText } from 'lucide-react'

// ---- Document checklist ----
// Keep `value` in sync with the server whitelist in functions/api/portal/documents/index.js.
export const DOC_TYPES = [
  { value: 'aadhaar',       label: 'Aadhaar Card',       short: 'Aadhaar',   icon: IdCard,        required: true,  hasNumber: true,  numberLabel: 'Aadhaar number', hint: 'Front & back, or the e-Aadhaar PDF.' },
  { value: 'photo',         label: 'Passport Photo',     short: 'Photo',     icon: Image,         required: true,  hasNumber: false, hint: 'Recent passport-size colour photo.' },
  { value: 'signature',     label: 'Signature',          short: 'Signature', icon: PenLine,       required: false, hasNumber: false, hint: 'Signature on plain white paper.' },
  { value: 'address_proof', label: 'Address Proof',      short: 'Address',   icon: Home,          required: false, hasNumber: false, hint: 'Aadhaar / utility bill / rent agreement.' },
  { value: 'dob_proof',     label: 'Date of Birth Proof',short: 'DOB',       icon: CalendarClock, required: false, hasNumber: false, hint: '10th marksheet / birth certificate / passport.' },
  { value: 'll_scan',       label: "Learner's Licence",  short: 'LL',        icon: ShieldCheck,   required: false, hasNumber: true,  numberLabel: 'LL number', hint: 'If you already have a Learner\'s Licence.' },
  { value: 'dl_scan',       label: 'Driving Licence',    short: 'DL',        icon: Car,           required: false, hasNumber: true,  numberLabel: 'DL number', hint: 'If you already hold a Driving Licence.' },
  { value: 'other',         label: 'Other Document',     short: 'Other',     icon: FileText,      required: false, hasNumber: false, hint: 'Any other supporting document.' }
]
export const DOC_TYPE_MAP = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t]))
export const docTypeLabel = (v) => DOC_TYPE_MAP[v]?.label || v

// True when the uploaded file is a PDF (so we show an icon instead of a thumbnail).
export const isPdf = (doc) =>
  doc?.file_format === 'pdf' || /\.pdf($|\?)/i.test(doc?.file_key || '')

// Turn a Cloudinary delivery URL into a forced-download URL (fl_attachment adds a
// Content-Disposition: attachment header, since the HTML `download` attribute is
// ignored cross-origin). Non-Cloudinary URLs are returned unchanged.
export function downloadUrl(fileKey) {
  if (!fileKey) return null
  if (/res\.cloudinary\.com/.test(fileKey) && fileKey.includes('/upload/')) {
    return fileKey.replace('/upload/', '/upload/fl_attachment/')
  }
  return fileKey
}

// ---- Learner's Licence application profile ----
// Mirrors the Sarathi "Application for Learner's Licence (LL) — General" form.
// Rendered generically from this schema; stored as { personal, present, permanent }.

export const RELATION_OPTIONS = ['Son of', 'Daughter of', 'Wife of', 'Ward of']
export const GENDER_OPTIONS = ['Male', 'Female', 'Transgender']
export const QUALIFICATION_OPTIONS = [
  'Below 10th', '10th (SSLC)', '12th (PUC)', 'Diploma', 'Graduate', 'Post Graduate', 'Illiterate', 'Other'
]
export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown']
export const AREA_TYPE_OPTIONS = ['Village', 'Town']

// field: { key, label, type, options?, required?, half?, placeholder? }
// half=true → the field takes one column of a 2-column grid on wider screens.
export const PERSONAL_FIELDS = [
  { key: 'rto_office',        label: 'RTO Office',            type: 'text',   half: true,  placeholder: 'e.g. Bengaluru East' },
  { key: 'first_name',        label: 'First name',            type: 'text',   half: true,  required: true },
  { key: 'middle_name',       label: 'Middle name',           type: 'text',   half: true },
  { key: 'last_name',         label: 'Last name',             type: 'text',   half: true },
  { key: 'full_name_records', label: 'Full name as per records', type: 'text' },
  { key: 'relation',          label: 'Relation',              type: 'select', options: RELATION_OPTIONS, half: true },
  { key: 'relative_name',     label: "Father's / guardian's name", type: 'text', half: true },
  { key: 'gender',            label: 'Gender',                type: 'select', options: GENDER_OPTIONS, half: true },
  { key: 'dob',               label: 'Date of birth',         type: 'date',   half: true,  required: true },
  { key: 'place_of_birth',    label: 'Place of birth',        type: 'text',   half: true },
  { key: 'country_of_birth',  label: 'Country of birth',      type: 'text',   half: true,  placeholder: 'India' },
  { key: 'qualification',     label: 'Qualification',         type: 'select', options: QUALIFICATION_OPTIONS, half: true },
  { key: 'blood_group',       label: 'Blood group',           type: 'select', options: BLOOD_GROUP_OPTIONS, half: true },
  { key: 'mobile',            label: 'Mobile number',         type: 'tel',    half: true },
  { key: 'emergency_mobile',  label: 'Emergency mobile',      type: 'tel',    half: true },
  { key: 'email',             label: 'Email',                 type: 'email',  half: true },
  { key: 'landline',          label: 'Landline',              type: 'tel',    half: true },
  { key: 'id_mark_1',         label: 'Identification mark 1', type: 'text',   half: true,  placeholder: 'e.g. Mole on right hand' },
  { key: 'id_mark_2',         label: 'Identification mark 2', type: 'text',   half: true }
]

export const ADDRESS_FIELDS = [
  { key: 'house',      label: 'House / Door / Flat no.',      type: 'text',   half: true },
  { key: 'street',     label: 'Street / Locality / Police station', type: 'text', half: true },
  { key: 'landmark',   label: 'Location / Landmark',          type: 'text',   half: true },
  { key: 'area_type',  label: 'Area',                         type: 'select', options: AREA_TYPE_OPTIONS, half: true },
  { key: 'area_name',  label: 'Village / Town',               type: 'text',   half: true },
  { key: 'taluka',     label: 'Taluka',                       type: 'text',   half: true },
  { key: 'district',   label: 'District',                     type: 'text',   half: true },
  { key: 'state',      label: 'State',                        type: 'text',   half: true,  placeholder: 'Karnataka' },
  { key: 'pincode',    label: 'Pincode',                      type: 'text',   half: true }
]

// Present address adds duration-of-stay; permanent address does not.
export const PRESENT_EXTRA_FIELDS = [
  { key: 'stay_years',  label: 'Stay: years',  type: 'number', half: true },
  { key: 'stay_months', label: 'Stay: months', type: 'number', half: true }
]

export const PROFILE_SECTIONS = [
  {
    key: 'personal',
    title: 'Personal details',
    fields: PERSONAL_FIELDS,
    required: ['first_name', 'last_name', 'gender', 'dob', 'mobile', 'qualification']
  },
  {
    key: 'present',
    title: 'Present address',
    fields: [...ADDRESS_FIELDS, ...PRESENT_EXTRA_FIELDS],
    required: ['state', 'district', 'taluka', 'landmark', 'pincode']
  },
  {
    // Permanent address is optional (use "Same as present" to copy it in).
    key: 'permanent',
    title: 'Permanent address',
    fields: ADDRESS_FIELDS,
    required: []
  }
]

// Field keys that must be filled before the profile can be saved, per section.
export const isRequired = (sectionKey, fieldKey) =>
  (PROFILE_SECTIONS.find((s) => s.key === sectionKey)?.required || []).includes(fieldKey)

// List [{ section, field }] of required fields that are still empty in `profile`.
export function missingRequired(profile) {
  const p = parseProfile(profile)
  const out = []
  for (const s of PROFILE_SECTIONS) {
    for (const key of s.required || []) {
      if (String(p[s.key]?.[key] ?? '').trim() === '') {
        const field = s.fields.find((f) => f.key === key)
        out.push({ section: s.title, label: field?.label || key })
      }
    }
  }
  return out
}

export const emptyProfile = () => ({ personal: {}, present: {}, permanent: {} })

// Parse the stored ll_profile (string or object) into a safe { personal, present, permanent }.
export function parseProfile(raw) {
  let p = raw
  if (typeof raw === 'string') {
    try { p = JSON.parse(raw || '{}') } catch { p = {} }
  }
  p = p || {}
  return {
    personal: p.personal && typeof p.personal === 'object' ? p.personal : {},
    present: p.present && typeof p.present === 'object' ? p.present : {},
    permanent: p.permanent && typeof p.permanent === 'object' ? p.permanent : {}
  }
}

// How many fields across all sections have a value — for the "N details filled" summary.
export function profileFilledCount(profile) {
  const p = parseProfile(profile)
  let n = 0
  for (const section of PROFILE_SECTIONS) {
    const vals = p[section.key] || {}
    for (const f of section.fields) {
      if (String(vals[f.key] ?? '').trim() !== '') n++
    }
  }
  return n
}
