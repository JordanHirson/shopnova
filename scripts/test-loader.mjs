/**
 * resolve/load hook for the Node test runner.
 *
 * Redirects bare `server-only` imports to an empty shim so provider
 * modules can be unit-tested outside a React server context. Everything
 * else resolves normally.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      url: new URL("./test-shim-server-only.js", import.meta.url).href,
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}
