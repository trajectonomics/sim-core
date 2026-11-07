/**
 * @trajectonomics/sim — Pure, deterministic personal-finance projection engine.
 *
 * Vocabulary types, `check()` and the deterministic projection engine.
 */

export { check } from "./check"
export type { ErrorCode, Path, Problem } from "./check/codes"
export { ERROR_CODES } from "./check/codes"
export { project } from "./engine/project"
export type * from "./types"
