export async function fetchFileArrayBufferService(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        throw new Error(`Failed to fetch file buffer: ${response.statusText}`);
    }
    return response.arrayBuffer();
}

export async function fetchBlobService(url: string): Promise<Blob> {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }
    return response.blob();
}
