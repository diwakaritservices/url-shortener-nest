export type ShortIdGenerator = () => string;

export async function createShortIdGenerator(
  alphabet: string,
  length: number,
): Promise<ShortIdGenerator> {
  const { customAlphabet } = await import('nanoid');

  return customAlphabet(alphabet, length);
}
