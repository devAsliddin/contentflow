import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Image, Video } from 'lucide-react'
import { cn } from '@/utils/cn'
import { api } from '@/services/api'
import { toast } from 'sonner'

interface UploadZoneProps {
  onUpload: (url: string, mediaType: 'image' | 'video') => void
  value?: string
  mediaType?: 'image' | 'video'
}

export default function UploadZone({ onUpload, value, mediaType }: UploadZoneProps) {
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
      toast.success('File uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
      'video/*': ['.mp4', '.mov'],
    },
    maxFiles: 1,
    disabled: uploading,
  })

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-border bg-card">
        {mediaType === 'video' ? (
          <video src={value} className="w-full max-h-64 object-contain" controls />
        ) : (
          <img src={value} alt="Preview" className="w-full max-h-64 object-contain" />
        )}
        <button
          onClick={() => onUpload('', 'image')}
          className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/30'
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading... {progress}%</p>
          </>
        ) : (
          <>
            <div className="flex gap-2 text-muted-foreground">
              <Image size={22} />
              <Video size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {isDragActive ? 'Drop it here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Images (20MB) or Videos (500MB)</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
