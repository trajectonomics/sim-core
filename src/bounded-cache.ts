/** A pure keyed cache with a hard size bound: clearing it only costs a recomputation. */
export class BoundedCache<Key, Value> {
	readonly #entries: Map<Key, Value> = new Map()
	readonly #limit: number

	constructor(limit: number) {
		this.#limit = limit
	}

	get(key: Key): Value | undefined {
		return this.#entries.get(key)
	}

	set(key: Key, value: Value): void {
		if (this.#entries.size >= this.#limit) this.#entries.clear()
		this.#entries.set(key, value)
	}
}
