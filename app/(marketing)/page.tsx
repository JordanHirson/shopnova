import { Container } from "@/components/layout/container"
import { Package } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center">
      <Container className="flex flex-col items-center gap-6 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Package className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          ShopNova
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          AI-powered e-commerce platform. Build, manage, and grow your online store with intelligent tools.
        </p>
        <div className="mt-4 h-1 w-16 rounded-full bg-primary/20" />
      </Container>
    </div>
  )
}