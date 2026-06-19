'use client'

interface Props {
  show: boolean
  message?: string
}

export default function LoadingOverlay({ show, message = 'Processing...' }: Props) {
  if (!show) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
      style={{ background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)' }}
    >
      {/* Spinner ring */}
      <div className="relative w-20 h-20">
        <div
          className="absolute inset-0 rounded-full border-4 animate-spin"
          style={{
            borderColor: 'rgba(255,255,255,.15)',
            borderTopColor: '#ffffff',
            animationDuration: '.8s',
          }}
        />
        <div className="absolute inset-3 rounded-full" style={{ background: 'rgba(34,57,77,.5)' }} />
        <div
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-3 h-3 rounded-full bg-white/80 animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-lg">{message}</p>
        <p className="text-white/50 text-sm mt-1">Please wait</p>
      </div>
    </div>
  )
}
