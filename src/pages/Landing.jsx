import { Link } from 'react-router-dom'
import {
  Building2, Users, CalendarDays, ClipboardCheck, CreditCard, Car,
  UserCog, Award, BellRing, Smartphone, ShieldCheck, LayoutGrid,
  Mail, Phone, ArrowRight,
} from 'lucide-react'

const CONTACT_EMAIL = 'sharath.hb03@gmail.com'
const CONTACT_PHONE = '8904880203'

// Every capability listed here maps to a screen that exists in the app.
const FEATURES = [
  {
    icon: Users,
    title: 'Student records',
    desc: 'Track each student through their stages, licenses and issued certificates in one profile.',
  },
  {
    icon: CalendarDays,
    title: 'Lesson scheduling',
    desc: 'Book lessons against instructors and vehicles with automatic conflict checks so nothing double-books.',
  },
  {
    icon: ClipboardCheck,
    title: 'Test scheduling',
    desc: 'Plan driving tests, record the test type and keep each student’s attempts together.',
  },
  {
    icon: CreditCard,
    title: 'Payments & packages',
    desc: 'Define packages and log payments against a student so balances stay clear.',
  },
  {
    icon: Car,
    title: 'Vehicles & documents',
    desc: 'Keep your fleet and its documents — insurance, PUC and more — on file and easy to find.',
  },
  {
    icon: UserCog,
    title: 'Instructors',
    desc: 'Manage instructors with their weekly availability and time-off so scheduling reflects reality.',
  },
  {
    icon: Award,
    title: 'Certificates & licenses',
    desc: 'Generate completion certificates and record licence details for each student.',
  },
  {
    icon: BellRing,
    title: 'Push reminders',
    desc: 'Send push notifications to students and instructors for upcoming lessons and tests.',
  },
]

const HIGHLIGHTS = [
  {
    icon: LayoutGrid,
    title: 'Separate portals for staff, students & instructors',
    desc: 'Admins run the school from a full dashboard, while students and instructors sign in to their own portal to see only what concerns them.',
  },
  {
    icon: Smartphone,
    title: 'Installable app that works offline',
    desc: 'Install Instrukt to a phone home screen like a native app. Core screens keep working when the connection drops.',
  },
  {
    icon: ShieldCheck,
    title: 'Isolated per school, role-based sign-in',
    desc: 'Each school’s data is kept separate, and everyone signs in with a role that controls what they can see and do.',
  },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-soft">
        <Building2 className="h-5 w-5 text-white" />
      </div>
      <span className="text-lg font-extrabold tracking-tight text-slate-900">
        Instrukt
      </span>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <Link to="/login" className="btn-primary px-4 py-2 text-sm">
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="chip bg-brand-100 text-brand-700">
              For driving schools
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Run your driving school in one place
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600">
              Students, lessons, tests, payments and vehicles — managed from a single dashboard,
              with dedicated portals for your students and instructors.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                Sign in <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#features" className="btn-ghost w-full px-6 py-3 text-base sm:w-auto">
                See what’s inside
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Everything a school runs on
          </h2>
          <p className="mt-3 text-slate-600">
            Each part of day-to-day operations has a home, so your team stops juggling spreadsheets and messages.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-6 lg:grid-cols-3">
            {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <div className="card overflow-hidden">
          <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Interested for your school?
              </h2>
              <p className="mt-3 text-slate-600">
                Already have an account? Sign in below. To get Instrukt set up for your
                school, get in touch and we’ll help you get started.
              </p>
              <div className="mt-6">
                <Link to="/login" className="btn-primary px-6 py-3 text-base">
                  Sign in <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</div>
                  <div className="font-semibold text-slate-900">{CONTACT_EMAIL}</div>
                </div>
              </a>
              <a
                href={`tel:${CONTACT_PHONE}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-card">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</div>
                  <div className="font-semibold text-slate-900">{CONTACT_PHONE}</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo />
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Instrukt
          </p>
        </div>
      </footer>
    </div>
  )
}
