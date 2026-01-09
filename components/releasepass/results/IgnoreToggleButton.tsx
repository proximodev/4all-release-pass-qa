'use client'

interface IgnoreToggleButtonProps {
  isIgnored: boolean
  isToggling: boolean
  onClick: (e: React.MouseEvent) => void
}

function LoadingSpinner() {
  return (
    <svg className="w-7 h-7 animate-spin" viewBox="0 0 32 32" fill="none">
      <circle
        className="opacity-100"
        cx="16"
        cy="16"
        r="12"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        className="opacity-100"
        fill="currentColor"
        d="M16 4a12 12 0 0112 12h-3a9 9 0 00-9-9V4z"
      />
    </svg>
  )
}

export function IgnoreToggleButton({ isIgnored, isToggling, onClick }: IgnoreToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isToggling}
      className="border-0"
      title={isIgnored ? 'Include in score' : 'Ignore (false positive)'}
    >
      {isToggling ? (
        <LoadingSpinner />
      ) : (
        <img
          src={isIgnored ? '/img/icon-add.svg' : '/img/icon-remove.svg'}
          alt={isIgnored ? 'Include in score' : 'Ignore'}
          className="w-7 h-7"
        />
      )}
    </button>
  )
}
