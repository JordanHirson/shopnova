export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          ShopNova MVP
        </h1>
        <p className="text-xl text-zinc-500 dark:text-zinc-400">
          Foundation Complete
        </p>
        <div className="mt-4 h-1 w-16 rounded-full bg-zinc-900/10 dark:bg-zinc-50/10" />
      </main>
    </div>
  );
}