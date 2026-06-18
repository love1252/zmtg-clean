/**
 * Lightweight tar.gz packer.
 * No external deps, runs fully in browser (no node:zlib).
 */
export async function packTarGz(
  files: Array<{ name: string; blob: Blob }>,
): Promise<Blob> {
  const parts: Uint8Array[] = [];

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const fileData = new Uint8Array(await file.blob.arrayBuffer());

    // tar header (512 bytes)
    const header = new Uint8Array(512);
    const view = new DataView(header.buffer);

    // name (100 bytes)
    let i = 0;
    for (; i < Math.min(nameBytes.length, 99); i++) {
      header[i] = nameBytes[i];
    }
    header[i] = 0; // null terminator

    // mode (offset 100, 8 bytes) = 0644
    view.setUint32(100, 0o644);

    // uid/gid (offset 108, 8 bytes each)
    view.setUint32(108, 0);
    view.setUint32(116, 0);

    // size (offset 124, 12 bytes) - octal
    const sizeStr = fileData.byteLength.toString(8).padStart(11, '0');
    for (let j = 0; j < 11; j++) {
      header[124 + j] = sizeStr.charCodeAt(j);
    }

    // mtime (offset 136, 12 bytes)
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0');
    for (let j = 0; j < 11; j++) {
      header[136 + j] = mtime.charCodeAt(j);
    }

    // typeflag (offset 156) = '0' (regular file)
    header[156] = 0x30;

    // checksum (offset 148, 8 bytes)
    view.setUint32(148, 0);
    let checksum = 0;
    for (let j = 0; j < 512; j++) {
      checksum += header[j];
    }
    const cksumStr = checksum.toString(8).padStart(7, '0') + '\0';
    for (let j = 0; j < 8; j++) {
      header[148 + j] = cksumStr.charCodeAt(j);
    }

    parts.push(header);

    // file data (padded to 512 bytes)
    parts.push(fileData);

    const padding = (512 - (fileData.byteLength % 512)) % 512;
    if (padding > 0) {
      parts.push(new Uint8Array(padding));
    }
  }

  // end-of-archive marker: 2 blank 512-byte blocks
  parts.push(new Uint8Array(512));
  parts.push(new Uint8Array(512));

  // Concatenate all parts
  const totalLength = parts.reduce((acc, p) => acc + p.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.byteLength;
  }

  return new Blob([result], { type: 'application/x-tar' });
}
