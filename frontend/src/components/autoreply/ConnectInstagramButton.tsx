import { Instagram, ShieldCheck } from 'lucide-react'
import Btn from '@/components/ui/Btn'
import { autoreplyService } from '@/services/autoreply.service'

export default function ConnectInstagramButton({ compact = false }: { compact?: boolean }) {
  function connect() {
    window.location.href = autoreplyService.instagramOAuthStartUrl()
  }

  if (compact) {
    return (
      <Btn variant="primary" icon={Instagram} onClick={connect}>
        Connect Instagram
      </Btn>
    )
  }

  return (
    <div className="bg-surface border border-line rounded-2xl p-6 max-w-md">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg,#7a1a5a,#f0427a 60%,#ffb056)' }}
      >
        <Instagram size={20} className="text-white" />
      </div>
      <h3 className="font-display text-lg text-ink mb-1.5">Instagram'ni ulang</h3>
      <p className="text-sm text-mute mb-4 leading-relaxed">
        Instagram parolingiz <span className="text-ink font-medium">so'ralmaydi</span> — ruxsatni
        Instagram'ning o'zida berasiz. Akkaunt <span className="text-ink font-medium">Professional</span>{' '}
        (Business yoki Creator) bo'lishi va <span className="text-ink font-medium">Facebook sahifaga</span>{' '}
        ulangan bo'lishi kerak.
      </p>
      <div className="flex items-center gap-1.5 text-[12px] text-faint mb-5">
        <ShieldCheck size={13} className="text-mint-500" />
        Faqat token saqlanadi, parol hech qachon emas.
      </div>
      <Btn variant="primary" icon={Instagram} onClick={connect}>
        Connect Instagram
      </Btn>
    </div>
  )
}
