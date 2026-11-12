import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center p-6">
      <div className="w-full max-w-md rounded-lg border border-muted p-8">
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6">
          <Link href="/dashboard">
            <a className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/80 transition-colors">
              Return to dashboard
            </a>
          </Link>
        </div>
      </div>
    </div>
  )
}