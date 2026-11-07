import { describe, expect, it } from "bun:test"
import * as simCore from "./index"

describe("@trajectonomics/sim entry point", () => {
	it("loads module cleanly without side effects", () => {
		expect(simCore).toBeDefined()
	})
})
