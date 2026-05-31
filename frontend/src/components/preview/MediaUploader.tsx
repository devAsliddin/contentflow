import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, X, Loader2 } from 'lucide-react'
import { api } from '@/services/api'
import { toast } from 'sonner'
import type { ContentType, PostAspect } from './types'

interface Props {
  contentType: ContentType
  postAspect: PostAspect
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  onUpload: (url: string, type: 'image' | 'video') => void
  onClear: () => void
}

function aspectStyle(contentType: ContentType, postAspect: PostAspect): string {
  if (contentType === 'post') return postAspect === '1:1' ? '1 / 1' : '4 / 5'
  return '9 / 16'
}

function aspectLabel(contentType: ContentType, postAspect: PostAspect): string {
  if (contentType === 'post') return postAspect
  return '9:16'
}

export default function MediaUploader({ contentType, postAspect, mediaUrl, mediaType, onUpload, onClear }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await api.post('/upload/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      onUpload(data.url, data.media_type)
      toast.success('Media uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'video/*': ['.mp4', '.mov'] },
    maxFiles: 1,
    disabled: uploading,
  })

  const aspect = aspectStyle(contentType, postAspect)
  const label = aspectLabel(contentType, postAspect)

  return (
    <div className="rounded-2xl bg-surface border border-line p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-faint">Media</div>
        <span className="text-[10px] font-mono text-mute bg-bg/60 border border-line px-2 py-0.5 rounded-md">{label}</span>
      </div>

      {mediaUrl ? (
        <div className="relative mx-auto overflow-hidden rounded-xl bg-black" style={{ aspectRatio: aspect, maxHeight: 400 }}>
          {mediaType === 'video' ? (
            <video src={mediaUrl} className="w-full h-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <img src={mediaUrl} alt="Upload preview" className="w-full h-full object-cover" />
          )}
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition"
          >
            <X size={13} />
          </button>
          <div className="absolute bottom-2 left-2 text-[10px] font-mono bg-black/60 backdrop-blur text-white px-2 py-0.5 rounded-md">
            {label}
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className="relative mx-auto overflow-hidden rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition bg-bg/40 hover:bg-bg/60"
          style={{
            aspectRatio: aspect,
            maxHeight: 400,
            borderColor: isDragActive ? '#6C63FF' : '#2A2A35',
          }}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
              <span className="text-xs text-mute">{progress}%</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                <UploadCloud size={20} className="text-indigo-400" />
              </div>
              <div>
                <div className="text-sm text-ink font-medium">
                  {isDragActive ? 'Drop here' : 'Upload media'}
                </div>
                <div className="text-[11px] text-faint mt-0.5">
                  {label} · JPG, PNG, MP4, MOV
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
