/** Edge outcomes the FI scan must keep exactly; recorded in `fi-snapshots.json` with the rest. */
import { expense, income } from "../engine/test-flows"
import { makeFixture } from "../engine/test-helpers"
import type { Fixture } from "../fixtures/fixture"

const cash = { id: "cash", kind: "asset", rate: 0 } as const

/** A candidate's own walk overflows, so the scan reports the problem as data. */
export const overflow: Fixture = makeFixture({
	accounts: [{ id: "savings", kind: "asset", rate: 0 }],
	balances: { savings: Number.MAX_SAFE_INTEGER },
	flows: [{ ...income("interest", 1), earned: false }],
	surplus: [{ account: "savings" }],
	withdraw: ["savings"],
	horizon: "2026-02-01",
})

/** A mid-month start whose horizon is in the same month leaves an empty candidate grid. */
export const noCandidate: Fixture = makeFixture({
	accounts: [cash],
	balances: { cash: 0 },
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	start: "2026-01-15",
	horizon: "2026-01-31",
})

/** The unmet amount is covered by a locked account, so the binding is `undrawableMoney`. */
export const undrawable: Fixture = makeFixture({
	accounts: [cash, { id: "vault", kind: "asset", rate: 0, lockedUntil: "2026-06-01" }],
	balances: { cash: 0, vault: 100 },
	flows: [expense("bill", 100, { start: "2026-01-01" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-01-01",
})

/** Nothing can cover the unmet amount, so the binding is `insufficientMoney`. */
export const insufficient: Fixture = makeFixture({
	accounts: [cash],
	balances: { cash: 0 },
	flows: [expense("bill", 100, { start: "2026-01-01" })],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-01-01",
})

/** The prefix runs out before every candidate, so the shortfall also stops the scan. */
export const beforeStop: Fixture = makeFixture({
	accounts: [cash],
	balances: { cash: 0 },
	flows: [
		income("jan", 100, { start: "2026-01-01" }),
		expense("jan-bill", 100, { start: "2026-01-01" }),
		expense("mid-month", 100, { start: "2026-01-15" }),
	],
	surplus: [{ account: "cash" }],
	withdraw: ["cash"],
	horizon: "2026-02-01",
})
