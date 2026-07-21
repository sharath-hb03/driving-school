// Certificate of completion: builds an SVG, uploads it to Cloudinary (rasterized to PNG
// on delivery), and records one row per student in the `certificates` table.
// Multi-tenant version: all queries are scoped to school_id.
import { id } from './utils.js'
import { isConfigured, svgDataUri, uploadDataUri, rasterUrl, attachmentUrl } from './cloudinary.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const licenseLabel = (t) => (t === '2W' ? '2-Wheeler' : t === '4W' ? '4-Wheeler' : '')

function prettyDate(ymd) {
  const [y, m, d] = String(ymd || '').slice(0, 10).split('-').map(Number)
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y}` : String(ymd || '')
}

// XML-escape dynamic text before dropping it into the SVG.
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

// Points for an n-pointed starburst (used behind the seal medallion).
function starPoints(cx, cy, outer, inner, points) {
  let p = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = (Math.PI * i) / points - Math.PI / 2
    p += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `
  }
  return p.trim()
}

// Classic navy + gold certificate, 1600×1131 (A4 landscape). Generic serif fonts so
// Cloudinary's SVG rasterizer always renders the text (no embedded-font dependency).
export function buildCertificateSvg({ schoolName, studentName, courseName, licenseType, classesCompleted, totalClasses, issuedOn, certificateNo, instructorName, signatoryName }) {
  const serif = "Georgia, 'Times New Roman', Times, serif"
  const sans = "Helvetica, Arial, sans-serif"
  const navy = '#1f3559'
  const gold = '#b8902f'
  const ink = '#3a4661'

  const lic = licenseLabel(licenseType)
  const course = courseName || (lic ? `${lic} Driving Course` : 'Driving Course')
  const metaBits = []
  if (totalClasses) metaBits.push(`${classesCompleted ?? totalClasses} of ${totalClasses} lessons`)
  if (lic) metaBits.push(lic)
  const meta = metaBits.join('  ·  ')

  const sealCy = 820
  const burst = starPoints(800, sealCy, 64, 51, 20)

  // A signature block: optional name (italic) above the rule, role label below.
  const sigBlock = (cx, name, label) => `
  ${name ? `<text x="${cx}" y="945" text-anchor="middle" font-family="${serif}" font-size="27" font-style="italic" fill="${navy}">${esc(name)}</text>` : ''}
  <line x1="${cx - 150}" y1="960" x2="${cx + 150}" y2="960" stroke="${ink}" stroke-width="1.5"/>
  <text x="${cx}" y="988" text-anchor="middle" font-family="${sans}" font-size="20" fill="${ink}">${esc(label)}</text>`

  const corner = (x, y) => `<rect x="${x - 9}" y="${y - 9}" width="18" height="18" transform="rotate(45 ${x} ${y})" fill="${gold}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131">
  <rect width="1600" height="1131" fill="#fbf9f3"/>

  <!-- steering-wheel watermark -->
  <g opacity="0.05" stroke="${gold}" fill="none" stroke-width="9">
    <circle cx="800" cy="545" r="232"/>
    <circle cx="800" cy="545" r="50"/>
    <line x1="850" y1="545" x2="1032" y2="545"/>
    <line x1="750" y1="545" x2="568" y2="545"/>
    <line x1="800" y1="595" x2="800" y2="777"/>
  </g>

  <!-- ornamental border -->
  <rect x="40" y="40" width="1520" height="1051" fill="none" stroke="${navy}" stroke-width="6"/>
  <rect x="62" y="62" width="1476" height="1007" fill="none" stroke="${gold}" stroke-width="1.5"/>
  <rect x="70" y="70" width="1460" height="991" fill="none" stroke="${gold}" stroke-width="0.75"/>
  ${[[70, 70], [1530, 70], [70, 1061], [1530, 1061]].map(([x, y]) => corner(x, y)).join('\n  ')}

  <!-- header -->
  <text x="800" y="158" text-anchor="middle" font-family="${sans}" font-size="30" letter-spacing="8" fill="${gold}" font-weight="bold">${esc(String(schoolName).toUpperCase())}</text>
  <line x1="640" y1="178" x2="960" y2="178" stroke="${gold}" stroke-width="0.75"/>
  <text x="800" y="250" text-anchor="middle" font-family="${serif}" font-size="60" letter-spacing="6" fill="${navy}" font-weight="bold">CERTIFICATE OF COMPLETION</text>

  <line x1="662" y1="290" x2="938" y2="290" stroke="${gold}" stroke-width="2"/>
  <circle cx="662" cy="290" r="4" fill="${gold}"/>
  <circle cx="938" cy="290" r="4" fill="${gold}"/>
  <rect x="792" y="282" width="16" height="16" transform="rotate(45 800 290)" fill="${gold}"/>

  <text x="800" y="382" text-anchor="middle" font-family="${serif}" font-size="30" font-style="italic" fill="${ink}">This is to certify that</text>

  <text x="800" y="476" text-anchor="middle" font-family="${serif}" font-size="76" font-weight="bold" fill="${navy}">${esc(studentName)}</text>
  <line x1="452" y1="506" x2="1148" y2="506" stroke="${gold}" stroke-width="1.5"/>
  <rect x="445" y="499" width="14" height="14" transform="rotate(45 452 506)" fill="${gold}"/>
  <rect x="1141" y="499" width="14" height="14" transform="rotate(45 1148 506)" fill="${gold}"/>

  <text x="800" y="572" text-anchor="middle" font-family="${serif}" font-size="28" font-style="italic" fill="${ink}">has successfully completed the</text>
  <text x="800" y="632" text-anchor="middle" font-family="${serif}" font-size="42" font-weight="bold" fill="${navy}">${esc(course)}</text>
  ${meta ? `<text x="800" y="682" text-anchor="middle" font-family="${sans}" font-size="23" fill="${ink}">${esc(meta)}</text>` : ''}
  <text x="800" y="722" text-anchor="middle" font-family="${sans}" font-size="23" fill="${ink}">Completed on ${esc(prettyDate(issuedOn))}</text>

  <!-- award medallion with ribbon -->
  <polygon points="800,${sealCy + 30} 815,${sealCy + 40} 770,${sealCy + 142} 749,${sealCy + 130} 762,${sealCy + 120}" fill="${navy}"/>
  <polygon points="800,${sealCy + 30} 785,${sealCy + 40} 830,${sealCy + 142} 851,${sealCy + 130} 838,${sealCy + 120}" fill="${gold}"/>
  <polygon points="${burst}" fill="${gold}"/>
  <circle cx="800" cy="${sealCy}" r="50" fill="#fbf9f3" stroke="${navy}" stroke-width="4"/>
  <circle cx="800" cy="${sealCy}" r="41" fill="none" stroke="${gold}" stroke-width="1.5"/>
  <path d="M779 ${sealCy - 4} l14 16 l32 -38" fill="none" stroke="${navy}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="800" y="${sealCy + 32}" text-anchor="middle" font-family="${sans}" font-size="11" letter-spacing="2" fill="${navy}" font-weight="bold">CERTIFIED</text>

  <!-- signatures -->
  ${sigBlock(330, instructorName, 'Instructor')}
  ${sigBlock(1270, signatoryName, 'Authorised Signatory')}

  <text x="800" y="1030" text-anchor="middle" font-family="${sans}" font-size="18" fill="#8a93a6">Certificate No. ${esc(certificateNo)}  ·  Issued ${esc(prettyDate(issuedOn))}</text>
</svg>`
}

export async function getCertificate(env, studentId, schoolId) {
  return env.DB.prepare('SELECT * FROM certificates WHERE student_id = ? AND school_id = ?').bind(studentId, schoolId).first()
}

// DSC-<year>-<sequence>, sequence is per-school per-year (UNIQUE constraint guards the rare race).
async function nextCertificateNo(env, schoolId) {
  const year = new Date().getFullYear()
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM certificates WHERE certificate_no LIKE ? AND school_id = ?')
    .bind(`DSC-${year}-%`, schoolId)
    .first()
  return `DSC-${year}-${String((row?.n || 0) + 1).padStart(4, '0')}`
}

const eligible = (status, done, total) => status === 'completed' || Boolean(total && done >= total)

// The instructor printed on the certificate: an explicit pick wins, otherwise the
// instructor this student has *attended the most* (total classes breaks ties).
async function resolveInstructorName(env, studentId, schoolId, instructorId) {
  if (instructorId) {
    const i = await env.DB.prepare('SELECT name FROM instructors WHERE id = ? AND school_id = ?').bind(instructorId, schoolId).first()
    if (i?.name) return i.name
  }
  const top = await env.DB.prepare(
    `SELECT i.name AS name
       FROM classes c JOIN instructors i ON i.id = c.instructor_id
      WHERE c.student_id = ? AND c.school_id = ? AND c.instructor_id IS NOT NULL
      GROUP BY c.instructor_id
      ORDER BY SUM(CASE WHEN c.status = 'attended' THEN 1 ELSE 0 END) DESC, COUNT(*) DESC
      LIMIT 1`
  )
    .bind(studentId, schoolId)
    .first()
  return top?.name || null
}

// The authorised signatory is the admin: an explicit name (the logged-in admin/staff) wins,
// then an optional CERT_SIGNATORY override, then the primary (oldest) admin account.
async function resolveSignatory(env, schoolId, signatoryName) {
  if (signatoryName) return signatoryName
  if (env.CERT_SIGNATORY) return env.CERT_SIGNATORY
  const a = await env.DB.prepare("SELECT name FROM users WHERE role = 'admin' AND school_id = ? ORDER BY created_at ASC LIMIT 1").bind(schoolId).first()
  return a?.name || null
}

// Generate (or regenerate) a student's certificate. Throws a clear Error when the student
// hasn't completed (unless allowOverride) or when Cloudinary isn't configured.
//   instructorId  — explicit instructor to print (else most-attended is used)
//   signatoryName — explicit authorised signatory (else CERT_SIGNATORY / primary admin)
export async function issueCertificate(env, studentId, schoolId, { issuedBy = 'system', allowOverride = false, instructorId = null, signatoryName = null } = {}) {
  const s = await env.DB.prepare(
    `SELECT s.id, s.name, s.status, s.license_type, s.package_id,
            p.name AS course_name, p.total_classes AS total,
            (SELECT COUNT(*) FROM classes c WHERE c.student_id = s.id AND c.school_id = s.school_id AND c.status = 'attended') AS done
       FROM students s LEFT JOIN packages p ON p.id = s.package_id
      WHERE s.id = ? AND s.school_id = ?`
  )
    .bind(studentId, schoolId)
    .first()
  if (!s) throw new Error('Student not found')
  if (!eligible(s.status, s.done, s.total) && !allowOverride) throw new Error('Student has not completed the course yet')
  if (!isConfigured(env)) throw new Error('Cloudinary is not configured')

  const existing = await getCertificate(env, studentId, schoolId)
  const certificateNo = existing?.certificate_no || (await nextCertificateNo(env, schoolId))
  const issuedOn = new Date().toISOString().slice(0, 10)
  const school = await env.DB.prepare('SELECT name FROM schools WHERE id = ?').bind(schoolId).first()
  const schoolName = school?.name || env.CERT_SCHOOL_NAME || env.APP_NAME || 'Driving School'
  const instructorNameResolved = await resolveInstructorName(env, studentId, schoolId, instructorId)
  const signatoryNameResolved = await resolveSignatory(env, schoolId, signatoryName)

  const svg = buildCertificateSvg({
    schoolName,
    studentName: s.name,
    courseName: s.course_name,
    licenseType: s.license_type,
    classesCompleted: s.done,
    totalClasses: s.total,
    issuedOn,
    certificateNo,
    instructorName: instructorNameResolved,
    signatoryName: signatoryNameResolved
  })

  const publicId = `instrukt/${schoolId}/certificates/${studentId}`
  const upload = await uploadDataUri(env, {
    dataUri: svgDataUri(svg),
    publicId,
    overwrite: true,
    eager: 'c_limit,w_1600,f_png',
    tags: 'certificate'
  })

  const imageUrl = rasterUrl(env, upload.public_id, upload.version)
  const downloadUrl = attachmentUrl(env, upload.public_id, upload.version, `certificate-${certificateNo}`)

  await env.DB.prepare(
    `INSERT INTO certificates
       (id, school_id, student_id, package_id, certificate_no, student_name, course_name, license_type,
        classes_completed, total_classes, issued_on, issued_by, instructor_name, signatory_name,
        cloudinary_public_id, cloudinary_url, image_url, download_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       package_id        = excluded.package_id,
       student_name      = excluded.student_name,
       course_name       = excluded.course_name,
       license_type      = excluded.license_type,
       classes_completed = excluded.classes_completed,
       total_classes     = excluded.total_classes,
       issued_on         = excluded.issued_on,
       issued_by         = excluded.issued_by,
       instructor_name   = excluded.instructor_name,
       signatory_name    = excluded.signatory_name,
       cloudinary_public_id = excluded.cloudinary_public_id,
       cloudinary_url    = excluded.cloudinary_url,
       image_url         = excluded.image_url,
       download_url      = excluded.download_url`
  )
    .bind(
      existing?.id || id('cert_'),
      schoolId,
      studentId,
      s.package_id || null,
      certificateNo,
      s.name,
      s.course_name || null,
      s.license_type || null,
      s.done ?? null,
      s.total ?? null,
      issuedOn,
      issuedBy,
      instructorNameResolved,
      signatoryNameResolved,
      publicId,
      upload.secure_url,
      imageUrl,
      downloadUrl
    )
    .run()

  return getCertificate(env, studentId, schoolId)
}

// Shared completion hook. Flips the student to "completed" once all package lessons are
// attended, then best-effort issues the certificate — Cloudinary failures are logged,
// never thrown, so attendance marking can't break.
export async function maybeCompleteAndCertify(env, studentId, schoolId, { issuedBy = 'system' } = {}) {
  const row = await env.DB.prepare(
    `SELECT s.status AS status, p.total_classes AS total,
            (SELECT COUNT(*) FROM classes c WHERE c.student_id = s.id AND c.school_id = s.school_id AND c.status = 'attended') AS done
       FROM students s LEFT JOIN packages p ON p.id = s.package_id
      WHERE s.id = ? AND s.school_id = ?`
  )
    .bind(studentId, schoolId)
    .first()
  if (!row || !row.total || row.done < row.total) return

  const justCompleted = row.status !== 'completed'
  if (justCompleted) {
    await env.DB.prepare("UPDATE students SET status = 'completed' WHERE id = ? AND school_id = ?").bind(studentId, schoolId).run()
  }

  // Only (re)issue when first completing or when no certificate exists yet — avoids
  // re-uploading on every extra attendance mark after completion.
  const existing = await getCertificate(env, studentId, schoolId)
  if (justCompleted || !existing) {
    try {
      await issueCertificate(env, studentId, schoolId, { issuedBy })
    } catch (e) {
      console.log('Certificate auto-issue failed:', e?.message)
    }
  }
}
