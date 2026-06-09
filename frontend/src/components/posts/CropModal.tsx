import { useState, useRef, useEffect } from 'react'
import { X, Check, Loader2, Move } from 'lucide-react'
import { api } from '@/services/api'
import { toast } from 'sonner'

// ─── Resolution presets ───────────────────────────────────────────────────────

interface Resolution {
  label: string
  category: string
  width: number
  height: number
  aspect: string
  ratio: number // width / height
}

const RESOLUTIONS: Resolution[] = [
  // Social
  { label: 'Square',            category: 'Social',    aspect: '1:1',    width: 1080, height: 1080,  ratio: 1 },
  { label: 'Instagram Portrait', category: 'Social',    aspect: '4:5',    width: 1080, height: 1350,  ratio: 4 / 5 },
  { label: 'Portrait',           category: 'Social',    aspect: '3:4',    width: 1080, height: 1440,  ratio: 3 / 4 },
  { label: 'Tall Portrait',      category: 'Social',    aspect: '2:3',    width: 1080, height: 1620,  ratio: 2 / 3 },
  // Vertical video
  { label: 'TikTok / Reels',    category: 'Vertical',  aspect: '9:16',   width: 1080, height: 1920,  ratio: 9 / 16 },
  { label: 'iPhone Full',        category: 'Vertical',  aspect: '9:19.5', width: 1080, height: 2340,  ratio: 9 / 19.5 },
  { label: 'Tall Crop',          category: 'Vertical',  aspect: '1:2',    width: 1080, height: 2160,  ratio: 1 / 2 },
  // Landscape
  { label: 'Widescreen HD',      category: 'Landscape', aspect: '16:9',   width: 1920, height: 1080,  ratio: 16 / 9 },
  { label: 'Classic',            category: 'Landscape', aspect: '3:2',    width: 1500, height: 1000,  ratio: 3 / 2 },
  { label: 'Standard',           category: 'Landscape', aspect: '4:3',    width: 1440, height: 1080,  ratio: 4 / 3 },
  { label: 'Wide',               category: 'Landscape', aspect: '16:10',  width: 1280, height: 800,   ratio: 16 / 10 },
  { label: 'Cinematic',          category: 'Landscape', aspect: '21:9',   width: 2560, height: 1080,  ratio: 21 / 9 },
  { label: 'Cinemascope',        category: 'Landscape', aspect: '2.35:1', width: 2350, height: 1000,  ratio: 2.35 },
  // Print / Editorial
  { label: 'A4 Landscape',       category: 'Print',     aspect: '√2:1',   width: 2480, height: 1754,  ratio: 2480 / 1754 },
  { label: 'A4 Portrait',        category: 'Print',     aspect: '1:√2',   width: 1754, height: 2480,  ratio: 1754 / 2480 },
  { label: 'US Letter',          category: 'Print',     aspect: '17:22',  width: 2550, height: 3300,  ratio: 2550 / 3300 },
]

const CATEGORY_COLOR: Record<string, string> = {
  Social:    'text-indigo-400',
  Vertical:  'text-violet-400',
  Landscape: 'text-sky-400',
  Print:     'text-amber-400',
}

// ─── Viewport constants ────────────────────────────────────────────────────────
// The crop box keeps the EXACT selected aspect ratio. It's fitted inside a
// max width/height envelope (never clamped on one axis only — that would make
// the on-screen box aspect differ from the exported aspect and break the crop).

const MAX_VP_W = 360
const MAX_VP_H = 460

interface Props {
  src: string
  onClose: () => void
  onApply: (url: string) => void
}

export default function CropModal({ src, onClose, onApply }: Props) {
  const [selected, setSelected] = useState<Resolution>(RESOLUTIONS[0])
  const [custom, setCustom] = useState(false)
  const [customW, setCustomW] = useState(1080)
  const [customH, setCustomH] = useState(1080)

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 })

  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgNat, setImgNat] = useState({ w: 1, h: 1 })
  const [applying, setApplying] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Current aspect ratio
  const ratio = custom ? customW / customH : selected.ratio
  // Fit the crop box inside the max envelope while preserving the exact ratio.
  // boxW / boxH === ratio always, so the exported scale is identical on both axes.
  let boxW = MAX_VP_W
  let boxH = Math.round(boxW / ratio)
  if (boxH > MAX_VP_H) {
    boxH = MAX_VP_H
    boxW = Math.round(boxH * ratio)
  }

  // Scale image to fill (cover) the crop box
  const scale = Math.max(boxW / imgNat.w, boxH / imgNat.h)
  const dispW = imgNat.w * scale
  const dispH = imgNat.h * scale

  // Clamp offset so image always covers the crop area
  function clamped(x: number, y: number) {
    return {
      x: Math.min(0, Math.max(boxW - dispW, x)),
      y: Math.min(0, Math.max(boxH - dispH, y)),
    }
  }

  // Center image whenever aspect changes
  useEffect(() => {
    if (imgLoaded) {
      const cx = (boxW - dispW) / 2
      const cy = (boxH - dispH) / 2
      setOffset(clamped(cx, cy))
    }
  }, [selected, custom, customW, customH, imgLoaded, dispW, dispH, boxW, boxH])

  // ── Mouse drag ──────────────────────────────────────────────────────────────

  function onMouseDown(e: React.MouseEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
    e.preventDefault()
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clamped(dragRef.current.ox + dx, dragRef.current.oy + dy))
  }
  function onDragEnd() { setDragging(false) }

  // ── Touch drag ──────────────────────────────────────────────────────────────

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    dragRef.current = { startX: t.clientX, startY: t.clientY, ox: offset.x, oy: offset.y }
    setDragging(true)
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return
    const t = e.touches[0]
    const dx = t.clientX - dragRef.current.startX
    const dy = t.clientY - dragRef.current.startY
    setOffset(clamped(dragRef.current.ox + dx, dragRef.current.oy + dy))
    e.preventDefault()
  }

  // ── Apply ───────────────────────────────────────────────────────────────────

  async function handleApply() {
    const outW = custom ? customW : selected.width
    const outH = custom ? customH : selected.height

    const canvas = canvasRef.current!
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    const img = imgRef.current!

    // boxW/boxH match the output aspect exactly, so a single scale is correct.
    const s = outW / boxW
    ctx.drawImage(img, -offset.x * s, -offset.y * s, dispW * s, dispH * s)

    setApplying(true)
    canvas.toBlob(async (blob) => {
      if (!blob) { toast.error('Crop failed'); setApplying(false); return }
      const formData = new FormData()
      formData.append('file', blob, 'cropped.jpg')
      try {
        const { data } = await api.post('/upload/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        onApply(data.url)
        toast.success(`Cropped · ${outW}×${outH}`)
        onClose()
      } catch {
        toast.error('Upload failed')
      } finally {
        setApplying(false)
      }
    }, 'image/jpeg', 0.92)
  }

  const categories = [...new Set(RESOLUTIONS.map((r) => r.category))]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-surface border border-line rounded-2xl shadow-2xl w-full max-w-[760px] flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line shrink-0">
          <span className="font-display text-base text-ink">Crop &amp; Resize</span>
          <button onClick={onClose} className="text-mute hover:text-ink transition p-1">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left — crop viewport */}
          <div className="flex-1 flex flex-col items-center justify-center bg-bg/40 p-5 gap-3">
            {/* Viewport */}
            <div
              className="relative overflow-hidden rounded-lg select-none"
              style={{
                width: boxW,
                height: boxH,
                cursor: dragging ? 'grabbing' : 'grab',
                boxShadow: '0 0 0 2px rgba(99,102,241,0.5)',
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onDragEnd}
            >
              {/* Image (real, for display) */}
              {imgLoaded && (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="absolute pointer-events-none"
                  style={{ width: dispW, height: dispH, transform: `translate(${offset.x}px,${offset.y}px)` }}
                />
              )}

              {/* Rule-of-thirds grid */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: [
                    'linear-gradient(rgba(255,255,255,0.07) 1px,transparent 1px)',
                    'linear-gradient(90deg,rgba(255,255,255,0.07) 1px,transparent 1px)',
                  ].join(','),
                  backgroundSize: `${boxW / 3}px ${boxH / 3}px`,
                }}
              />

              {/* Corner handles */}
              {(['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const).map((pos) => (
                <div
                  key={pos}
                  className="absolute w-4 h-4 pointer-events-none"
                  style={{
                    top:    pos.includes('top')    ? 0 : undefined,
                    bottom: pos.includes('bottom') ? 0 : undefined,
                    left:   pos.includes('left')   ? 0 : undefined,
                    right:  pos.includes('right')  ? 0 : undefined,
                    borderTop:    pos.includes('top')    ? '2px solid rgba(255,255,255,0.8)' : undefined,
                    borderBottom: pos.includes('bottom') ? '2px solid rgba(255,255,255,0.8)' : undefined,
                    borderLeft:   pos.includes('left')   ? '2px solid rgba(255,255,255,0.8)' : undefined,
                    borderRight:  pos.includes('right')  ? '2px solid rgba(255,255,255,0.8)' : undefined,
                  }}
                />
              ))}

              {/* Loading state */}
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-mute" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-faint">
              <Move size={10} />
              Drag to reposition
            </div>

            {/* Output dimensions */}
            <div className="text-[11px] text-mute tnum">
              Output: {custom ? `${customW}×${customH}` : `${selected.width}×${selected.height}`} px
            </div>
          </div>

          {/* Right — resolution list */}
          <div className="w-56 border-l border-line flex flex-col overflow-hidden">
            <div className="text-[10px] uppercase tracking-[0.14em] text-faint px-3 py-2.5 border-b border-line shrink-0">
              Aspect ratio
            </div>
            <div className="flex-1 overflow-y-auto py-1">

              {/* Custom */}
              <div className="px-2 pt-1 pb-2">
                <button
                  onClick={() => setCustom(true)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition ${
                    custom
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-ink'
                      : 'bg-bg/40 border-line text-mute hover:border-line2 hover:text-ink'
                  }`}
                >
                  ✏️ Custom size
                </button>
                {custom && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {[['W', customW, setCustomW], ['H', customH, setCustomH]].map(([label, val, set]) => (
                      <div key={label as string}>
                        <div className="text-[9px] uppercase text-faint mb-1">{label as string}</div>
                        <input
                          type="number"
                          value={val as number}
                          onChange={(e) => (set as (v: number) => void)(Math.max(100, Math.min(7680, Number(e.target.value))))}
                          className="w-full px-2 py-1 rounded-md bg-bg border border-line text-ink text-xs focus:outline-none focus:border-indigo-500/60"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-line mx-2 mb-1" />

              {/* Presets grouped by category */}
              {categories.map((cat) => (
                <div key={cat}>
                  <div className={`px-3 pt-2 pb-1 text-[9px] uppercase tracking-[0.14em] font-semibold ${CATEGORY_COLOR[cat] || 'text-faint'}`}>
                    {cat}
                  </div>
                  {RESOLUTIONS.filter((r) => r.category === cat).map((r) => (
                    <button
                      key={r.aspect}
                      onClick={() => { setCustom(false); setSelected(r) }}
                      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 transition text-xs ${
                        !custom && selected.aspect === r.aspect
                          ? 'bg-indigo-500/10 text-ink'
                          : 'text-mute hover:bg-surface hover:text-ink'
                      }`}
                    >
                      {/* Mini aspect ratio rect */}
                      <div className="w-7 h-7 flex items-center justify-center shrink-0">
                        <div
                          className={`bg-line2/60 rounded-sm border ${
                            !custom && selected.aspect === r.aspect ? 'border-indigo-400/60' : 'border-line2'
                          }`}
                          style={{
                            width:  r.ratio >= 1 ? 22 : Math.round(22 * r.ratio),
                            height: r.ratio >= 1 ? Math.round(22 / r.ratio) : 22,
                            minWidth: 4,
                            minHeight: 4,
                            maxWidth: 22,
                            maxHeight: 22,
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{r.aspect}</div>
                        <div className="text-[9px] text-faint truncate">{r.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-line shrink-0">
          <div className="text-xs text-faint tnum">
            {custom ? `Custom · ${customW}×${customH}` : `${selected.aspect} · ${selected.label}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-line text-sm text-ink hover:bg-surface2 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={applying || !imgLoaded}
              className="px-4 py-1.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition flex items-center gap-1.5 disabled:opacity-60"
            >
              {applying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Apply
            </button>
          </div>
        </div>

        {/* Hidden source image + canvas for export */}
        <img
          ref={imgRef}
          src={src}
          crossOrigin="anonymous"
          onLoad={() => {
            const img = imgRef.current!
            setImgNat({ w: img.naturalWidth, h: img.naturalHeight })
            setImgLoaded(true)
          }}
          className="hidden"
          alt=""
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
