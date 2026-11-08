// Read the central directory independently of the streaming writer, for tests.
export function readZip(bytes: Uint8Array) {
  const zip = Buffer.from(bytes);
  const end = zip.length - 22;
  if (zip.readUInt32LE(end) !== 0x06054b50) throw new Error("ZIP incomplet");
  const result = new Map<string, Buffer>();
  let offset = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("En-tête ZIP invalide");
    const length = zip.readUInt16LE(offset + 28);
    const name = zip
      .subarray(offset + 46, offset + 46 + length)
      .toString("utf8");
    const local = zip.readUInt32LE(offset + 42);
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    result.set(
      name,
      zip.subarray(start, start + zip.readUInt32LE(offset + 24)),
    );
    offset +=
      46 +
      length +
      zip.readUInt16LE(offset + 30) +
      zip.readUInt16LE(offset + 32);
  }
  return result;
}
