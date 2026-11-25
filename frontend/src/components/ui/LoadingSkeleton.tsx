interface LoadingSkeletonProps {
  rows?: number
  height?: number
}

export function LoadingSkeleton({ rows = 4, height = 18 }: LoadingSkeletonProps) {
  return (
    <div className="d-flex flex-column gap-2 py-2">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="vx-skeleton"
          style={{
            height,
            width: idx % 2 === 0 ? '100%' : '82%',
          }}
        />
      ))}
    </div>
  )
}
