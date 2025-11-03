import React from 'react'

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

const VersionBadge: React.FC = () => {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const time = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
  if (!version) return null
  return (
    <div
      style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 9999 }}
      className="px-3 py-2 rounded-lg text-sm font-semibold bg-black/80 text-white backdrop-blur shadow-lg border border-white/20"
      aria-label={`Build ${version}`}
      title={`Version ${version}\nBuilt ${time}`}
    >
      v{version}
    </div>
  )
}

export default VersionBadge


