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

/**
 * Extracts dropped files and directories (preserving relative paths) from a browser DataTransfer.
 */
export async function extractDroppedFileItems(
  dataTransfer: DataTransfer,
): Promise<{ file: File; name: string }[]> {
  const dtItems = dataTransfer.items;
  const allItems: { file: File; name: string }[] = [];
  const folderEntries: FileSystemDirectoryEntry[] = [];
  const plainFiles: File[] = [];

  if (dtItems?.length) {
    for (let i = 0; i < dtItems.length; i++) {
      const entry = dtItems[i].webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        folderEntries.push(entry as FileSystemDirectoryEntry);
      } else if (entry?.isFile) {
        const file = dataTransfer.files[i];
        if (file) plainFiles.push(file);
      }
    }
  } else {
    plainFiles.push(...Array.from(dataTransfer.files));
  }

  for (const file of plainFiles) {
    allItems.push({ file, name: file.name });
  }

  for (const dir of folderEntries) {
    const folderFiles = await readEntriesRecursively(dir, dir.name);
    for (const { file, relativePath } of folderFiles) {
      allItems.push({ file, name: relativePath });
    }
  }

  return allItems;
}
