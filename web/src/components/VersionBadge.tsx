import React from 'react'

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

const VersionBadge: React.FC = () => {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'
  const time = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : ''
  if (!version) return null
  return (
    <div
      style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 50 }}
      className="px-2 py-1 rounded-md text-xs bg-black/60 text-white backdrop-blur"
      aria-label={`Build ${version}`}
      title={`Version ${version}\nBuilt ${time}`}
    >
      v{version}
    </div>
  )
}

export default VersionBadge


