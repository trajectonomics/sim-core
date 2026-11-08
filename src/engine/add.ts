/** Adds `amount` to the bigint stored at `key`, defaulting a missing key to zero. */
export function addTo(map: Map<string, bigint>, key: string, amount: bigint): void {
	map.set(key, (map.get(key) ?? 0n) + amount)
}
