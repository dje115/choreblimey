import React, { useEffect, useState } from 'react'

interface ConfettiProps {
  active: boolean
  onComplete?: () => void
}

export const Confetti: React.FC<ConfettiProps> = ({ active, onComplete }) => {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string; delay: number }[]>([])

  useEffect(() => {
    if (!active) {
      setParticles([])
      return
    }

    const colors = ['#FF8A00', '#2D9BF0', '#00C897', '#FEC93D', '#FFD700', '#FF6B9D', '#9B59B6']
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.3,
    }))

    setParticles(newParticles)

    const timer = setTimeout(() => {
      setParticles([])
      if (onComplete) onComplete()
    }, 2000)

    return () => clearTimeout(timer)
  }, [active, onComplete])

  if (!active || particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-3 h-3 rounded-full animate-confetti-fall"
          style={{
            left: `${particle.x}%`,
            top: '-10%',
            backgroundColor: particle.color,
            animationDelay: `${particle.delay}s`,
            animationDuration: '2s',
          }}
        />
      ))}
    </div>
  )
}

export default Confetti

