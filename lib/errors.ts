import { Prisma } from "@prisma/client"

/**
 * An error whose message is written for end users and is safe to display.
 * Anything else is treated as unexpected and replaced with a generic message.
 */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AppError"
  }
}

/**
 * Logs an error on the server so failures are never lost, even when the
 * caller shows the user a generic message.
 */
export function logError(operation: string, error: unknown): void {
  console.error(`[shopnova] ${operation} failed:`, error)
}

/**
 * Logs an unexpected but non-fatal condition (e.g. missing seed data).
 */
export function logWarning(operation: string, message: string): void {
  console.warn(`[shopnova] ${operation}: ${message}`)
}

function conflictingFields(
  error: Prisma.PrismaClientKnownRequestError
): string | null {
  const target = error.meta?.target
  if (typeof target === "string") return target
  if (Array.isArray(target)) {
    const fields = target.filter((t): t is string => typeof t === "string")
    return fields.length > 0 ? fields.join(", ") : null
  }
  return null
}

/**
 * Logs an error and returns a message that is safe to send to the browser.
 *
 * Raw database errors are never forwarded: known Prisma failures are
 * translated into actionable messages and anything unrecognized falls back
 * to the caller's generic message.
 */
export function toUserMessage(
  operation: string,
  error: unknown,
  fallback: string
): string {
  logError(operation, error)

  if (error instanceof AppError) {
    return error.message
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const fields = conflictingFields(error)
        return fields
          ? `Another record already uses this ${fields}. Choose a different value.`
          : "Another record already uses one of these values. Choose a different value."
      }
      case "P2003":
      case "P2014":
        return "This record is still linked to other records and cannot be changed. Remove those first."
      case "P2025":
        return "That record no longer exists. Refresh the page and try again."
    }
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return "The database is unavailable right now. Please try again."
  }

  return fallback
}
