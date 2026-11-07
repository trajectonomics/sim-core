/**
 * @trajectonomics/sim — Pure, deterministic personal-finance projection engine.
 *
 * Vocabulary types, `check()`, the deterministic projection engine and the Levy Measure evaluator.
 */

export { check } from "./check"
export type { ErrorCode, Path, Problem } from "./check/codes"
export { ERROR_CODES } from "./check/codes"
export { project } from "./engine/project"
export { evaluateMeasures } from "./levy/evaluate"
export type * from "./types"
