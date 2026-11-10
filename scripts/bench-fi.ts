// Times the FI scan on both fixtures at a 60-year horizon. Run: bun run bench

import type { Fixture } from "../src/fixtures/fixture"
import { freelancer } from "../src/fixtures/freelancer"
import { thaiEmployee } from "../src/fixtures/thai-employee"
import { financialIndependence } from "../src/index"
import type { SurvivalOptions } from "../src/types"

const HORIZON = "2086-01-01"
const RUNS = 3

interface Measurement {
	readonly name: string
	readonly ms: number
	readonly month: string
}

function atSixtyYears(fixture: Fixture): Fixture {
	return { ...fixture, timeline: { ...fixture.timeline, horizon: HORIZON, resolution: "month" } }
}

function measure(name: string, fixture: Fixture, options: SurvivalOptions): Measurement {
	const { baseline, scenario, timeline } = atSixtyYears(fixture)
	financialIndependence(baseline, scenario, timeline, options)
	const started = Bun.nanoseconds()
	for (let run = 0; run < RUNS; run++) financialIndependence(baseline, scenario, timeline, options)
	const ms = (Bun.nanoseconds() - started) / 1e6 / RUNS
	const result = financialIndependence(baseline, scenario, timeline, options)
	const month =
		result.ok && result.financialIndependence.reachable
			? result.financialIndependence.month
			: "unreachable"
	return { name, ms, month }
}

const measurements = [
	measure("freelancer", freelancer, { method: "survival" }),
	measure("freelancer buffer 6", freelancer, { method: "survival", minBufferMonths: 6 }),
	measure("thai-employee", thaiEmployee, { method: "survival" }),
	measure("thai-employee buffer 6", thaiEmployee, { method: "survival", minBufferMonths: 6 }),
]

for (const { name, ms, month } of measurements) {
	console.log(`${name.padEnd(24)} ${ms.toFixed(1).padStart(9)} ms   ${month}`)
}
const plain = measurements.filter((item) => !item.name.includes("buffer"))
console.log(`plain total ${plain.reduce((sum, item) => sum + item.ms, 0).toFixed(1)} ms`)
