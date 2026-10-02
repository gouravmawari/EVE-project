export const money = (value: unknown) =>
  value == null ? value : value.toString();
export function serialize<T extends Record<string, any>>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, v) =>
      v?.constructor?.name === 'Decimal' ? v.toString() : v,
    ),
  );
}
