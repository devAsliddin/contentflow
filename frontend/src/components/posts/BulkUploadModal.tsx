import { useState, useCallback, useRef } from 'react'
import { X, UploadCloud, CheckCircle2, XCircle, Loader2, File as FileIcon } from 'lucide-react'
import { workflowsService, type BulkUploadItem } from '@/services/workflows.service'

interface Props {
  onClose: () => void
  onUploaded?: (items: BulkUploadItem[]) => void
}

interface FileState {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  result?: BulkUploadItem
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BulkUploadModal({ onClose, onUploaded }: Props) {
  const [files, setFiles] = useState<FileState[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: File[]) => {
    const total = files.length + newFiles.length
    if (total > 10) {
      alert('Maksimal 10 ta fayl')
      return
    }
    setFiles((prev) => [
      ...prev,
      ...newFiles.map((f) => ({ file: f, status: 'pending' as const })),
    ])
  }, [files.length])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    addFiles(dropped)
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setUploading(true)

    // Upload all at once
    const fileList = files.map((f) => f.file)

    // Mark all as uploading
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'uploading' })))

    try {
      const result = await workflowsService.bulkUpload(fileList)

      // Map results back to file states
      setFiles((prev) =>
        prev.map((f, i) => {
          const item = result.items[i]
          if (!item) return { ...f, status: 'error' }
          return {
            ...f,
            status: item.error ? 'error' : 'done',
            result: item,
          }
        })
      )

      const successItems = result.items.filter((item) => !item.error)
      if (successItems.length > 0 && onUploaded) {
        onUploaded(successItems)
      }
    } catch (err: any) {
      setFiles((prev) => prev.map((f) => ({ ...f, status: 'error' })))
    } finally {
      setUploading(false)
    }
  }

  const allDone = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error')
  const successCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 px-4">
        <div className="w-full max-w-lg bg-bg border border-line rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b border-line flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-display text-lg text-ink">Bulk Upload</h2>
              <div className="text-xs text-faint">Bir vaqtda 10 tagacha fayl</div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-md text-faint hover:text-ink hover:bg-surface">
              <X size={16} />
            </button>
          </div>

          {/* Drop zone */}
          {!allDone && (
            <div
              onDragEnter={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`m-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer transition ${
                dragOver ? 'border-indigo-500 bg-indigo-500/5' : 'border-line hover:border-line2 hover:bg-surface/60'
              }`}
            >
              <UploadCloud size={28} className="text-mute mb-3" />
              <div className="text-sm text-ink font-medium">Fayllarni tashlang yoki bosing</div>
              <div className="text-xs text-faint mt-1">JPG, PNG, WebP, MP4, MOV · maks 10 ta</div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(Array.from(e.target.files))
                  e.target.value = ''
                }}
              />
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
              {files.map((f, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
                    f.status === 'done'
                      ? 'bg-mint-500/5 border-mint-500/20'
                      : f.status === 'error'
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : 'bg-surface border-line'
                  }`}
                >
                  <FileIcon size={16} className="text-faint shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-ink truncate">{f.file.name}</div>
                    <div className="text-[10px] text-faint">{formatBytes(f.file.size)}</div>
                    {f.status === 'error' && f.result?.error && (
                      <div className="text-[10px] text-rose-400 mt-0.5">{f.result.error}</div>
                    )}
                    {f.status === 'done' && f.result?.url && (
                      <div className="text-[10px] text-mint-500 mt-0.5 truncate font-mono">{f.result.url}</div>
                    )}
                  </div>
                  {f.status === 'uploading' && <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />}
                  {f.status === 'done' && <CheckCircle2 size={14} className="text-mint-500 shrink-0" />}
                  {f.status === 'error' && <XCircle size={14} className="text-rose-400 shrink-0" />}
                  {f.status === 'pending' && !uploading && (
                    <button
                      onClick={() => removeFile(i)}
                      className="p-0.5 rounded text-faint hover:text-rose-400"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="p-5 border-t border-line shrink-0">
            {allDone ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-mint-500 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> {successCount} muvaffaqiyatli
                  </span>
                  {errorCount > 0 && (
                    <span className="text-rose-400 flex items-center gap-1.5">
                      <XCircle size={14} /> {errorCount} xato
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition"
                >
                  Yopish
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-surface border border-line text-sm text-ink hover:bg-surface2 transition"
                >
                  Bekor
                </button>
                <button
                  onClick={handleUpload}
                  disabled={files.length === 0 || uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 disabled:opacity-50 transition"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Yuklanmoqda...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} />
                      Upload {files.length > 0 ? `(${files.length})` : ''}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
