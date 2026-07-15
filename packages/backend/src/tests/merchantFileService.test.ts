import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import express from 'express';
import {
  MAX_FILE_SIZE,
  UPLOAD_FILE_PATH,
  createMerchantFileUploader,
  validateMerchantFile,
} from '../services/merchantFileService';
import { parseMultipartFile } from '../utils/multipart';
import { createMerchantFileRouter } from '../routes/merchantFile';

const PDF_BYTES = Buffer.from('%PDF-1.4 test file');

describe('validateMerchantFile', () => {
  it('accepts an allowed extension at the 5 MB boundary', () => {
    assert.doesNotThrow(() => validateMerchantFile('license.PDF', MAX_FILE_SIZE));
  });

  it('rejects an empty file, unsupported extension, and a file over 5 MB', () => {
    assert.throws(() => validateMerchantFile('license.pdf', 0), /must not be empty/);
    assert.throws(() => validateMerchantFile('license.exe', 10), /Unsupported file type/);
    assert.throws(() => validateMerchantFile('license.pdf', MAX_FILE_SIZE + 1), /5 MB/);
    assert.throws(() => validateMerchantFile(`${'a'.repeat(125)}.pdf`, 10), /128 characters/);
  });
});

describe('parseMultipartFile', () => {
  it('preserves the uploaded filename and bytes', async () => {
    const form = new FormData();
    form.append('file', new Blob([PDF_BYTES], { type: 'application/pdf' }), 'business_license.pdf');
    const request = new Request('http://localhost/upload', { method: 'POST', body: form });
    const rawBody = Buffer.from(await request.arrayBuffer());

    const parsed = await parseMultipartFile(request.headers.get('content-type') || '', rawBody);

    assert.equal(parsed.fileName, 'business_license.pdf');
    assert.equal(parsed.mimeType, 'application/pdf');
    assert.deepEqual(parsed.buffer, PDF_BYTES);
  });

  it('rejects a non-multipart request and multiple files', async () => {
    await assert.rejects(() => parseMultipartFile('application/json', Buffer.from('{}')), /multipart\/form-data/);

    const form = new FormData();
    form.append('file', new Blob([PDF_BYTES]), 'one.pdf');
    form.append('file', new Blob([PDF_BYTES]), 'two.pdf');
    const request = new Request('http://localhost/upload', { method: 'POST', body: form });
    const rawBody = Buffer.from(await request.arrayBuffer());

    await assert.rejects(
      () => parseMultipartFile(
        request.headers.get('content-type') || '',
        rawBody,
      ),
      /exactly one file/,
    );
  });
});

describe('merchant file uploader', () => {
  it('signs only the body JSON and sends the raw file as multipart data', async () => {
    const signed: string[][] = [];
    let capturedForm: FormData | undefined;
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> | undefined;
    const uploader = createMerchantFileUploader({
      config: {
        mockMode: false,
        bigSizeBaseUrl: 'https://open-big-sea.alipay.com/',
        clientId: 'client-id',
        privateKey: 'private-key',
        integrationPartnerId: 'partner-id',
        agentToken: 'agent-token',
      },
      now: () => new Date('2026-07-14T00:00:00.000Z'),
      sign: (...args) => {
        signed.push(args);
        return 'encoded-signature';
      },
      fetch: async (url, init) => {
        capturedUrl = String(url);
        capturedForm = init?.body as FormData;
        capturedHeaders = init?.headers as Record<string, string> | undefined;
        return new Response(JSON.stringify({
          result: { resultCode: 'SUCCESS', resultMessage: 'success', resultStatus: 'S' },
          fileName: 'business_license.pdf',
          fileKey: 'file-key',
          fileSize: String(PDF_BYTES.length),
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      sleep: async () => undefined,
    });

    const response = await uploader.uploadFile({
      requestId: 'REQ_1',
      referenceMerchantId: 'REF_1',
      fileName: 'business_license.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });

    const expectedBody = JSON.stringify({
      requestId: 'REQ_1',
      merchant: {
        integrationPartnerId: 'partner-id',
        referenceMerchantId: 'REF_1',
      },
      fileSha256: createHash('sha256').update(PDF_BYTES).digest('hex'),
    });
    assert.deepEqual(signed, [[
      UPLOAD_FILE_PATH,
      'client-id',
      '2026-07-14T00:00:00.000+00:00',
      expectedBody,
      'private-key',
    ]]);
    assert.equal(capturedUrl, `https://open-big-sea.alipay.com${UPLOAD_FILE_PATH}`);
    assert.equal(capturedForm?.get('body'), expectedBody);
    const uploadedFile = capturedForm?.get('file');
    assert.ok(uploadedFile instanceof File);
    assert.equal(uploadedFile.name, 'business_license.pdf');
    assert.deepEqual(Buffer.from(await uploadedFile.arrayBuffer()), PDF_BYTES);
    const headers = new Headers(capturedHeaders);
    assert.equal(headers.get('client-id'), 'client-id');
    assert.equal(headers.get('agent-token'), 'agent-token');
    assert.equal(headers.has('content-type'), false);
    assert.equal(response.fileKey, 'file-key');
  });

  it('retries U with the same request and does not call Antom in mock mode', async () => {
    let attempts = 0;
    const uploader = createMerchantFileUploader({
      config: {
        mockMode: false,
        bigSizeBaseUrl: 'https://example.test',
        clientId: 'client-id',
        privateKey: 'private-key',
        integrationPartnerId: 'partner-id',
      },
      sign: () => 'signature',
      fetch: async () => {
        attempts += 1;
        const status = attempts < 3 ? 'U' : 'S';
        return new Response(JSON.stringify({
          result: { resultCode: status === 'S' ? 'SUCCESS' : 'UNKNOWN', resultMessage: status, resultStatus: status },
          ...(status === 'S' ? { fileName: 'license.pdf', fileKey: 'key', fileSize: String(PDF_BYTES.length) } : {}),
        }), { headers: { 'Content-Type': 'application/json' } });
      },
      sleep: async () => undefined,
    });
    await uploader.uploadFile({
      requestId: 'REQ_RETRY',
      referenceMerchantId: 'REF_1',
      fileName: 'license.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });
    assert.equal(attempts, 3);

    const mockUploader = createMerchantFileUploader({
      config: {
        mockMode: true,
        bigSizeBaseUrl: 'https://example.test',
        clientId: '',
        privateKey: '',
        integrationPartnerId: 'partner-id',
      },
      sign: () => { throw new Error('sign must not be called'); },
      fetch: async () => { throw new Error('fetch must not be called'); },
    });
    const mockResult = await mockUploader.uploadFile({
      requestId: 'REQ_MOCK',
      referenceMerchantId: 'REF_1',
      fileName: 'license.pdf',
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    });
    assert.equal(mockResult.result.resultStatus, 'S');
    assert.match(mockResult.fileKey || '', /^mock_/);
  });
});

describe('merchant file route', () => {
  it('uploads one file, persists metadata, and returns it', async () => {
    const saved: Array<{ merchantId: string; fileName: string; fileSize: number }> = [];
    const router = createMerchantFileRouter({
      findMerchant: async () => ({ id: 'merchant-1', referenceMerchantId: 'REF_1' }),
      listFiles: async () => [],
      saveFile: async (data) => {
        saved.push(data);
        return { id: 'file-1', createdAt: new Date().toISOString(), ...data };
      },
      uploadFile: async (input) => ({
        result: { resultCode: 'SUCCESS', resultMessage: 'success', resultStatus: 'S' },
        fileName: input.fileName,
        fileKey: 'file-key',
        fileSize: String(input.buffer.length),
        fileSha256: createHash('sha256').update(input.buffer).digest('hex'),
      }),
    });

    await withRouterServer(router, async (baseUrl) => {
      const form = new FormData();
      form.append('file', new Blob([PDF_BYTES], { type: 'application/pdf' }), 'business_license.pdf');
      const response = await fetch(`${baseUrl}/api/merchants/merchant-1/files`, { method: 'POST', body: form });
      const body = await response.json() as Record<string, unknown>;

      assert.equal(response.status, 201);
      assert.equal(body.fileKey, 'file-key');
      assert.equal(saved.length, 1);
      assert.equal(saved[0]?.merchantId, 'merchant-1');
      assert.equal(saved[0]?.fileName, 'business_license.pdf');
      assert.equal(saved[0]?.fileSize, PDF_BYTES.length);
    });
  });

  it('rejects missing, unsupported, and oversized files before persistence', async () => {
    let uploadCalls = 0;
    const router = createMerchantFileRouter({
      findMerchant: async () => ({ id: 'merchant-1', referenceMerchantId: 'REF_1' }),
      listFiles: async () => [],
      saveFile: async () => { throw new Error('save must not be called'); },
      uploadFile: async () => {
        uploadCalls += 1;
        throw new Error('upload must not be called');
      },
    });

    await withRouterServer(router, async (baseUrl) => {
      const missing = await fetch(`${baseUrl}/api/merchants/merchant-1/files`, {
        method: 'POST',
        body: new FormData(),
      });
      assert.equal(missing.status, 400);

      const unsupportedForm = new FormData();
      unsupportedForm.append('file', new Blob([Buffer.from('bad')]), 'malware.exe');
      const unsupported = await fetch(`${baseUrl}/api/merchants/merchant-1/files`, {
        method: 'POST',
        body: unsupportedForm,
      });
      assert.equal(unsupported.status, 400);

      const oversizedForm = new FormData();
      oversizedForm.append('file', new Blob([Buffer.alloc(MAX_FILE_SIZE + 1)]), 'large.pdf');
      const oversized = await fetch(`${baseUrl}/api/merchants/merchant-1/files`, {
        method: 'POST',
        body: oversizedForm,
      });
      assert.equal(oversized.status, 413);
      assert.equal(uploadCalls, 0);
    });
  });
});

async function withRouterServer(
  router: express.Router,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use('/api/merchants', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
