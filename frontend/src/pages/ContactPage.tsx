import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MessageSquare, Twitter } from 'lucide-react'

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-bg text-ink px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-mute hover:text-ink transition mb-8">
          <ArrowLeft size={14} /> Bosh sahifaga qaytish
        </Link>
        <h1 className="font-display text-4xl tracking-tight mb-4">Aloqa</h1>
        <p className="text-mute mb-10">Savollaringiz bormi? Biz yordam berishdan xursandmiz.</p>
        <div className="space-y-4">
          <a
            href="mailto:support@contentflow.uz"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-line hover:border-line2 transition"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Mail size={18} className="text-indigo-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-ink">Elektron pochta</div>
              <div className="text-xs text-faint">support@contentflow.uz</div>
            </div>
          </a>
          <a
            href="https://t.me/contentflow_support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-line hover:border-line2 transition"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <MessageSquare size={18} className="text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-medium text-ink">Telegram</div>
              <div className="text-xs text-faint">@contentflow_support</div>
            </div>
          </a>
          <a
            href="https://twitter.com/contentflow_uz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-line hover:border-line2 transition"
          >
            <div className="w-10 h-10 rounded-lg bg-surface2 flex items-center justify-center">
              <Twitter size={18} className="text-mute" />
            </div>
            <div>
              <div className="text-sm font-medium text-ink">Twitter / X</div>
              <div className="text-xs text-faint">@contentflow_uz</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
