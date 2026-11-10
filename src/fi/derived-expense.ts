import type { Path } from "../check/codes"
import { flowRefsOf } from "../levy/refs"
import type { Flow, Scenario } from "../types"
import { isDerived } from "../types"
import type { InputProblem } from "../types/projection"

function indexFlows(flows: readonly Flow[]): ReadonlyMap<string, number> {
	const index = new Map<string, number>()
	for (let position = 0; position < flows.length; position++) {
		const flow = flows[position]
		if (flow !== undefined && !index.has(flow.id)) index.set(flow.id, position)
	}
	return index
}

function flowAt(
	flows: readonly Flow[],
	index: ReadonlyMap<string, number>,
	id: string,
): Flow | undefined {
	const position = index.get(id)
	return position === undefined ? undefined : flows[position]
}

/** Whether a Flow reads earned income, directly or through a chain of Derived amounts. */
function readsEarned(
	flows: readonly Flow[],
	index: ReadonlyMap<string, number>,
	start: string,
): boolean {
	const seen = new Set<string>()
	const stack = [start]
	while (stack.length > 0) {
		const id = stack.pop()!
		if (seen.has(id)) continue
		seen.add(id)
		const flow = flowAt(flows, index, id)
		if (flow === undefined) continue
		if (flow.kind === "income" && flow.earned) return true
		if (isDerived(flow)) stack.push(...flowRefsOf(flow.derive))
	}
	return false
}

/**
 * A Derived expense that reads earned income, transitively: earned income stops in an FI
 * candidate, so the expense would fall to 0 and make the answer too early. The FI entry rejects
 * it unless `retirementSpending` replaces every expense after the FI month.
 */
export function derivedExpenseProblem(scenario: Scenario): InputProblem | undefined {
	const index = indexFlows(scenario.flows)
	for (let position = 0; position < scenario.flows.length; position++) {
		const flow = scenario.flows[position]
		if (flow === undefined || flow.kind !== "expense" || !isDerived(flow)) continue
		if (readsEarned(scenario.flows, index, flow.id)) {
			const path: Path = ["scenario", "flows", position, "derive"]
			return { code: "DERIVED_EXPENSE_READS_EARNED", path }
		}
	}
	return undefined
}
