/** TEST-ONLY row helpers; not imported by `src/index.ts`, so they stay out of the package. */
import type { ProjectionRow } from "../types/projection"

/** One Account's split on a row: capitalised, accrued interest and their total. */
export function splitAt(
	row: ProjectionRow,
	account: string,
): Omit<ProjectionRow["balances"][number], "account"> {
	const found = row.balances.find((item) => item.account === account)
	if (found === undefined) throw new Error(`Missing balance ${account} on ${row.date}`)
	return {
		capitalised: found.capitalised,
		accruedInterest: found.accruedInterest,
		amount: found.amount,
	}
}
