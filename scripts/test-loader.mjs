/**
 * resolve/load hook for the Node test runner.
 *
 * Redirects bare `server-only` imports to an empty shim so provider
 * modules can be unit-tested outside a React server context. Everything
 * else resolves normally.
 *
 * Node's `--experimental-strip-types` does not auto-append `.ts` for
 * extensionless relative VALUE imports (type-only imports are stripped, so
 * they never resolve at runtime). Production bundlers (webpack/turbopack)
 * do resolve them, so provider modules legitimately write
 * `import { x } from "./local-module"`. To keep that working under the test
 * runner, an extensionless relative specifier that fails to resolve is
 * retried with `.ts` appended.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      url: new URL("./test-shim-server-only.js", import.meta.url).href,
      shortCircuit: true,
    }
  }
  try {
    return await nextResolve(specifier, context)
  } catch (err) {
    if (
      err?.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.endsWith(".ts") &&
      !specifier.endsWith(".js") &&
      !specifier.endsWith(".mjs") &&
      !specifier.endsWith(".json")
    ) {
      return nextResolve(specifier + ".ts", context)
    }
    throw err
  }
}
