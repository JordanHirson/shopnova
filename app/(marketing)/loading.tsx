export default function StorefrontLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="h-10 w-1/2 bg-muted rounded animate-pulse" />
        <div className="h-10 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => (
          <div key={i} className="aspect-[4/5] bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}