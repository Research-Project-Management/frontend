/**
 * Directory drag & drop entry reader (recursively reads all files in dropped directory)
 */
export async function readEntriesRecursively(
  dirEntry: FileSystemDirectoryEntry,
  basePath: string,
): Promise<{ file: File; relativePath: string }[]> {
  const results: { file: File; relativePath: string }[] = [];
  const reader = dirEntry.createReader();

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  let batch: FileSystemEntry[];
  do {
    batch = await readBatch();
    for (const entry of batch) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        );
        results.push({ file, relativePath: `${basePath}/${file.name}` });
      } else if (entry.isDirectory) {
        const subResults = await readEntriesRecursively(
          entry as FileSystemDirectoryEntry,
          `${basePath}/${entry.name}`,
        );
        results.push(...subResults);
      }
    }
  } while (batch.length > 0);

  return results;
}
