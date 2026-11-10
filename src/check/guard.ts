import type { Emit } from "./codes"

export type Root = "baseline" | "scenario" | "timeline" | "options" | "model"

/**
 * Runs `run`, turning an exception (a throwing getter, a revoked Proxy) into one `NOT_AN_OBJECT`
 * problem at the input's root, reported at most once per root. Returns `fallback` on failure.
 *
 * It deliberately catches EVERY exception, not only input-access ones: `check()` must never throw
 * on garbage input. The trade-off is that a genuine bug in a check surfaces as `NOT_AN_OBJECT` on
 * that input instead of crashing; the tests (not this guard) are what expose such bugs.
 */
export function makeGuard(emit: Emit): <T>(root: Root, fallback: T, run: () => T) => T {
	const failed = new Set<Root>()
	return (root, fallback, run) => {
		try {
			return run()
		} catch {
			if (!failed.has(root)) emit("NOT_AN_OBJECT", [root])
			failed.add(root)
			return fallback
		}
	}
}
