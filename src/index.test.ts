import { describe, expect, it } from "bun:test"
import type { Calendar, DayRule } from "./index"
import * as simCore from "./index"

describe("@trajectonomics/sim entry point", () => {
	it("loads module cleanly without side effects", () => {
		expect(simCore).toBeDefined()
	})

	it("exports the Calendar vocabulary types", () => {
		const dayRule: DayRule = "next"
		const calendar: Calendar = { dayRule, holidays: ["2026-01-01"] }
		expect(calendar.holidays).toEqual(["2026-01-01"])
	})
})
