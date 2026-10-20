import { createFileRoute } from "@tanstack/react-router"
import { FieldBook } from "@/components/fieldbook/app"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  return <FieldBook />
}
