import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg text-ink px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink transition mb-8">
          <ArrowLeft size={14} /> Bosh sahifaga qaytish
        </Link>
        <h1 className="font-display text-4xl tracking-tight mb-4">Foydalanish shartlari</h1>
        <p className="text-sm text-faint mb-8">Kuchga kirish sanasi: 2025-yil 1-yanvar</p>
        <div className="space-y-6 text-mute leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Xizmatdan foydalanish</h2>
            <p>ContentFlow'dan foydalanish orqali siz ushbu shartlarga rozilik bildirasiz. Xizmat faqat qonuniy maqsadlar uchun ishlatilishi kerak.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Hisob mas'uliyati</h2>
            <p>Siz o'z hisobingiz xavfsizligi uchun javobgarsiz. Hisobingizdan ruxsatsiz foydalanilganini sezсangиз, darhol bizga xabar bering.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Kontent siyosati</h2>
            <p>Platformamiz orqali joylashtirilgan kontentlar ijtimoiy tarmoqlar qoidalariga mos kelishi kerak. Spam, noto'g'ri ma'lumot yoki zararli kontent taqiqlanadi.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Xizmat ko'rsatishni to'xtatish</h2>
            <p>ContentFlow istalgan vaqtda xizmatni o'zgartirish yoki to'xtatish huquqini saqlab qoladi. Muhim o'zgarishlar haqida foydalanuvchilarga oldindan xabar beriladi.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
