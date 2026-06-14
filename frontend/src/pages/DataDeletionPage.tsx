import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-bg text-ink px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink transition mb-8">
          <ArrowLeft size={14} /> Bosh sahifaga qaytish
        </Link>
        <h1 className="font-display text-4xl tracking-tight mb-4">Ma'lumotlarni o'chirish</h1>
        <p className="text-sm text-faint mb-8">Data Deletion Instructions · So'nggi yangilanish: 2026-yil 15-iyun</p>
        <div className="space-y-6 text-mute leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Qanday ma'lumot saqlanadi</h2>
            <p>
              ContentFlow ulangan Instagram/Facebook hisoblaringiz uchun kirish tokenlarini (shifrlangan
              holda), hisob nomi va ID'sini, hamda siz yaratgan post va avtomatik javob qoidalarini saqlaydi.
              Parollar hech qachon saqlanmaydi.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Hisobni ilova ichida o'chirish</h2>
            <p>
              Ulangan hisobni istalgan vaqtda o'zingiz uzishingiz mumkin: <span className="text-ink">Dashboard → Accounts → </span>
              tegishli hisob → <span className="text-ink">Uzish (Disconnect)</span>. Uzilganda o'sha hisobga oid
              token va ma'lumotlar tizimdan o'chiriladi.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">To'liq o'chirishni so'rash</h2>
            <p>
              Barcha ma'lumotlaringizni (akkaunt bilan birga) butunlay o'chirishni xohlasangiz, quyidagi
              manzilga <span className="text-ink">"Delete my data"</span> mavzusида xat yuboring va ro'yxatdan
              o'tgan elektron pochtangizni ko'rsating:
            </p>
            <p className="mt-2">
              <a href="mailto:asultonov040@gmail.com?subject=Delete%20my%20data" className="text-indigo-400 hover:text-indigo-300">
                asultonov040@gmail.com
              </a>
            </p>
            <p className="mt-2">So'rovingiz 30 kun ichida ko'rib chiqiladi va ma'lumotlaringiz to'liq o'chiriladi.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-ink mb-2">Instagram/Facebook tomonidan</h2>
            <p>
              Shuningdek, Instagram yoki Facebook sozlamalaridan (Settings → Apps and websites) ContentFlow
              ilovasini olib tashlasangiz, bizning ilovamizning hisobingizga kirishi darhol bekor qilinadi.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
