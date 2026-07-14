export interface ParsedMultipartFile {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Parse a buffered multipart request with Node's standards-based FormData parser.
 * The caller is responsible for enforcing the request-size limit before buffering.
 */
export async function parseMultipartFile(
  contentType: string,
  rawBody: Buffer,
): Promise<ParsedMultipartFile> {
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new Error('Content-Type must be multipart/form-data with a boundary');
  }

  let form: FormData;
  try {
    form = await new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(rawBody),
    }).formData();
  } catch {
    throw new Error('Invalid multipart/form-data request');
  }

  const files = form.getAll('file');
  if (files.length !== 1 || typeof files[0] === 'string') {
    throw new Error('Upload must contain exactly one file field');
  }

  const file = files[0];
  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    buffer: Buffer.from(await file.arrayBuffer()),
  };
}
