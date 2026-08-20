/**
 * Node test-runner loader hook.
 *
 * Maps the `server-only` marker package to an empty shim so payment
 * provider modules (which legitimately use `import "server-only"` to
 * keep them out of client bundles) can be imported by Node's native
 * test runner. Loaded via `node --import ./scripts/test-register.mjs`.
 *
 * No other module resolution is affected.
 */
import { register } from "node:module"

register(
  new URL("./test-loader.mjs", import.meta.url).href,
  import.meta.url
)
