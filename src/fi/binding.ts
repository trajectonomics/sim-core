import type {
	FiBestCase,
	FiBinding,
	FinancialIndependence,
	FinancialIndependenceDefinition,
} from "../types/financial-independence"
import type { BufferFailure, ShortfallFailure } from "./best"

function bufferBest(failure: BufferFailure): FiBestCase {
	return {
		month: failure.month,
		bufferBreach: {
			date: failure.breach.date,
			required: Number(failure.breach.required),
			accessible: Number(failure.breach.accessible),
		},
	}
}

function shortfallBest(failure: ShortfallFailure): FiBestCase {
	return {
		month: failure.month,
		runsOut: {
			date: failure.shortfall.date,
			unmet: Number(failure.shortfall.unmet),
		},
	}
}

function bindingOf(failure: ShortfallFailure): FiBinding {
	if (failure.shortfall.date < failure.month) return "shortfallBeforeStop"
	return failure.shortfall.undrawable >= failure.shortfall.unmet
		? "undrawableMoney"
		: "insufficientMoney"
}

/** The not-reachable answer: a buffer-only best case beats any shortfall. */
export function unreachable(
	definition: FinancialIndependenceDefinition,
	buffer: BufferFailure | undefined,
	shortfall: ShortfallFailure | undefined,
): FinancialIndependence {
	if (buffer !== undefined) {
		return { reachable: false, definition, binding: "minimumBuffer", bestCase: bufferBest(buffer) }
	}
	if (shortfall !== undefined) {
		return {
			reachable: false,
			definition,
			binding: bindingOf(shortfall),
			bestCase: shortfallBest(shortfall),
		}
	}
	return { reachable: false, definition, binding: "noCandidateMonth" }
}
