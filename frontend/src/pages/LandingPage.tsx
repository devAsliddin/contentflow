import { Link } from 'react-router-dom'
import {
  Calendar,
  Zap,
  BarChart3,
  Shield,
  Instagram,
  Send,
  Video,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'

const features = [
  {
    icon: <Sparkles size={20} />,
    title: 'AI Caption Generator',
    description: 'Claude AI yordamida har bir platforma uchun kuchli captionlar yarating.',
  },
  {
    icon: <Calendar size={20} />,
    title: 'Smart Scheduling',
    description: 'Postlarni oldindan rejalashtirib, avtomatik nashr etish oqimini sozlang.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Analytics Dashboard',
    description: 'Barcha platformalar bo\'yicha statistika va ishlash ko\'rsatkichlari.',
  },
  {
    icon: <Shield size={20} />,
    title: 'Approval Workflow',
    description: 'Kontent tasdiqlash jarayonini sozlang, xatolar oldini oling.',
  },
  {
    icon: <Zap size={20} />,
    title: 'Bulk Upload',
    description: 'Bir vaqtda yuzlab postni yuklang va rejalashtirib qo\'ying.',
  },
  {
    icon: <Video size={20} />,
    title: 'Multi-Platform',
    description: 'Instagram, TikTok va Telegram — bitta paneldan boshqaring.',
  },
]

const platforms = [
  { name: 'Instagram', icon: <Instagram size={22} />, color: 'from-pink-500 to-purple-600' },
  { name: 'Telegram', icon: <Send size={22} />, color: 'from-blue-400 to-blue-600' },
  { name: 'TikTok', icon: <Video size={22} />, color: 'from-gray-800 to-gray-600' },
]

const plans = [
  {
    name: 'Starter',
    price: '$0',
    period: 'forever',
    features: ['3 ta platforma', '30 post/oy', 'Asosiy analytics', 'AI caption (10/oy)'],
    cta: 'Bepul boshlash',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/oy',
    features: ['Cheksiz platformalar', 'Cheksiz postlar', 'Kengaytirilgan analytics', 'AI caption (cheksiz)', 'Approval workflow', 'Bulk upload'],
    cta: 'Pro boshlash',
    highlight: true,
  },
  {
    name: 'Agency',
    price: '$49',
    period: '/oy',
    features: ['Hamma Pro xususiyatlar', '10 ta jamoa a\'zosi', 'White-label', 'API kirishvi', 'Ustuvor qo\'llab-quvvatlash'],
    cta: 'Agency boshlash',
    highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">

      {/* ─── Navbar ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0"
              style={{ background: 'linear-gradient(135deg, #6C63FF 0%, #00F5A0 100%)' }}
            >
              <div className="absolute inset-[1px] rounded-[7px] bg-bg flex items-center justify-center">
                <span className="font-display text-[13px] font-semibold text-grad-indigo">CF</span>
              </div>
            </div>
            <span className="font-display text-[15px] text-ink tracking-tight">ContentFlow</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-mute">
            <a href="#features" className="hover:text-ink transition">Xususiyatlar</a>
            <a href="#platforms" className="hover:text-ink transition">Platformalar</a>
            <a href="#pricing" className="hover:text-ink transition">Narxlar</a>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-mute hover:text-ink transition px-3 py-1.5"
            >
              Kirish
            </Link>
            <Link
              to="/register"
              className="text-sm px-4 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 transition font-medium"
              style={{ boxShadow: '0 0 16px -4px rgba(108,99,255,0.5)' }}
            >
              Boshlash
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-24 px-4 text-center relative overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-medium mb-6">
            <Sparkles size={12} />
            Claude AI bilan ishlaydi
          </div>

          <h1 className="font-display text-4xl md:text-6xl text-ink tracking-tight leading-tight mb-5">
            Kontent rejalashtirish{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #6C63FF 0%, #00F5A0 100%)' }}
            >
              yangi darajada
            </span>
          </h1>

          <p className="text-base md:text-lg text-mute max-w-xl mx-auto mb-8 leading-relaxed">
            Instagram, TikTok va Telegramni bitta paneldan boshqaring.
            AI yordamida caption yozing, avtomatik rejalashtirib, statistikani kuzating.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-400 transition"
              style={{ boxShadow: '0 0 24px -6px rgba(108,99,255,0.6)' }}
            >
              Bepul boshlash
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-line text-ink rounded-xl font-medium hover:border-indigo-500/40 transition"
            >
              Hisobga kirish
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[
              { value: '10k+', label: 'Foydalanuvchi' },
              { value: '2M+', label: 'Post nashr' },
              { value: '3', label: 'Platforma' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-display font-semibold text-ink">{stat.value}</div>
                <div className="text-xs text-faint mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Platforms ───────────────────────────────────────────────────── */}
      <section id="platforms" className="py-16 px-4 border-y border-line">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-faint mb-8">Qo'llab-quvvatlanadigan platformalar</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {platforms.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2.5 px-5 py-3 bg-surface border border-line rounded-xl"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center text-white`}>
                  {p.icon}
                </div>
                <span className="font-medium text-sm text-ink">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-3">
              Kerakli hamma narsa
            </h2>
            <p className="text-mute text-sm max-w-md mx-auto">
              Professional SMM mutaxassis kabi ishlash uchun zarur bo'lgan barcha vositalar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-5 bg-surface border border-line rounded-2xl hover:border-indigo-500/30 transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 transition">
                  {f.icon}
                </div>
                <h3 className="font-medium text-sm text-ink mb-1">{f.title}</h3>
                <p className="text-xs text-mute leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 border-t border-line">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-3">Narxlar</h2>
            <p className="text-mute text-sm">Kichik biznesdan yirik agentlikgacha.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-6 rounded-2xl border ${
                  plan.highlight
                    ? 'border-indigo-500/50 bg-indigo-500/5'
                    : 'border-line bg-surface'
                } relative flex flex-col`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-0.5 bg-indigo-500 text-white text-[10px] font-semibold uppercase tracking-widest rounded-full">
                      Mashhur
                    </span>
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-xs uppercase tracking-[0.12em] text-faint mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="font-display text-3xl text-ink">{plan.price}</span>
                    <span className="text-xs text-mute mb-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-mute">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    plan.highlight
                      ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                      : 'border border-line text-ink hover:border-indigo-500/40'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-line">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-4">
            Bugun boshlang
          </h2>
          <p className="text-mute text-sm mb-8">
            Kredit karta talab qilinmaydi. Bepul rejada boshlang.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-400 transition text-sm"
            style={{ boxShadow: '0 0 32px -8px rgba(108,99,255,0.7)' }}
          >
            Bepul hisob yaratish
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-line py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md"
              style={{ background: 'linear-gradient(135deg, #6C63FF 0%, #00F5A0 100%)' }}
            />
            <span className="text-sm font-display text-mute">ContentFlow</span>
          </div>
          <p className="text-xs text-faint">© 2025 ContentFlow. Barcha huquqlar himoyalangan.</p>
          <div className="flex gap-5 text-xs text-faint">
            <a href="#" className="hover:text-mute transition">Maxfiylik</a>
            <a href="#" className="hover:text-mute transition">Shartlar</a>
            <a href="#" className="hover:text-mute transition">Aloqa</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
