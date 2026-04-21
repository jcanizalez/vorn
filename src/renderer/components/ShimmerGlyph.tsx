const outerIndices = new Set([1, 2, 4, 7, 8, 11, 13, 14])
const cornerIndices = new Set([0, 3, 12, 15])

const squares = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: (i % 4) * 4,
  y: Math.floor(i / 4) * 4,
  delay: Math.random() * 1.5,
  duration: 1 + Math.random(),
  outer: outerIndices.has(i),
  corner: cornerIndices.has(i)
}))

interface Props {
  size?: number
  className?: string
  'aria-label'?: string
}

export function ShimmerGlyph({ size = 12, className, 'aria-label': ariaLabel }: Props) {
  return (
    <svg
      viewBox="0 0 15 15"
      width={size}
      height={size}
      data-component="shimmer-glyph"
      className={className}
      fill="currentColor"
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : 'presentation'}
    >
      {squares.map((square) => (
        <rect
          key={square.id}
          x={square.x}
          y={square.y}
          width="3"
          height="3"
          rx="1"
          style={
            square.corner
              ? { opacity: 0 }
              : {
                  animation: `${square.outer ? 'pulse-opacity-dim' : 'pulse-opacity'} ${square.duration}s ease-in-out infinite both`,
                  animationDelay: `${square.delay}s`
                }
          }
        />
      ))}
    </svg>
  )
}
