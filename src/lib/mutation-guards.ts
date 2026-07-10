type MutationError = { message: string } | null;

export function assertUpdatedRows<T>(
  result: { data: T[] | null; error: MutationError },
  label: string,
) {
  if (result.error) throw result.error;
  if (!result.data || result.data.length === 0) {
    throw new Error(`${label} was not updated. The database update policy blocked this edit.`);
  }
}