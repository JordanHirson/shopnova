export const UNAUTHORIZED_MESSAGE = "You must be signed in to do that."

const PRISMA_MESSAGES: Record<string, string> = {
  P2002: "A record with those unique values already exists.",
  P2003: "That reference is invalid.",
  P2025: "The record no longer exists.",
}

function prismaErrorCode(err: unknown): string | null {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code
    if (typeof code === "string") return code
  }
  return null
}

/**
 * Converts a thrown error into a message that is safe to return to the client.
 *
 * Raw error messages can carry database, schema, or connection details, so they
 * are logged server-side and replaced with a generic fallback.
 */
export function toClientErrorMessage(err: unknown, fallback: string): string {
  console.error(err)

  const code = prismaErrorCode(err)
  if (code && PRISMA_MESSAGES[code]) return PRISMA_MESSAGES[code]

  return fallback
}
