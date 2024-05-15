export function ensureArray(item: string | string[], split?: ','): string[] {
	if (item == null) return [];
	const items = Array.isArray(item) ? item : [item];
	return items.flatMap((item) => (split ? item.split(split) : [item]));
}

export function oneOf(array: string | string[]) {
	return ensureArray(array)
		.map((x) => `'${x}'`)
		.join(', or ');
}
