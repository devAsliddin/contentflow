import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg text-ink px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink transition mb-8">
          <ArrowLeft size={14} /> Bosh sahifaga qaytish
        </Link>
        <h1 className="font-display text-4xl tracking-tight mb-4">Maxfiylik siyosati</h1>
        <p className="text-sm text-faint mb-8">So'nggi yangilanish: 2025-yil 1-yanvar</p>
        <div className="space-y-6 text-mute leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Ma'lumot to'plash</h2>
            <p>ContentFlow faqat xizmatni taqdim etish uchun zarur bo'lgan ma'lumotlarni to'playdi: elektron pochta, to'liq ism va ulangan ijtimoiy tarmoq hisoblaringiz uchun kirish tokenları.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Ma'lumotdan foydalanish</h2>
            <p>Sizning ma'lumotlaringiz uchinchi shaxslarga sotilmaydi yoki ulashilmaydi. Biz faqat sizga yaxshiroq xizmat ko'rsatish maqsadida foydalaniladi.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Cookie fayllar</h2>
            <p>Biz tizimga kirish sessiyalarini saqlash uchun xavfsiz cookie fayllardan foydalanamiz. Brauzeringiz sozlamalarida cookie fayllarni o'chirib qo'yishingiz mumkin.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibent text-ink mb-2">Bog'lanish</h2>
            <p>Maxfiylik haqida savollaringiz bo'lsa: <a href="mailto:privacy@contentflow.uz" className="text-indigo-400 hover:text-indigo-300">privacy@contentflow.uz</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
