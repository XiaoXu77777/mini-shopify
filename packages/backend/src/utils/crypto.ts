import crypto from 'crypto';

/**
 * Sign a request to Antom API.
 *
 * Step 1: Construct content_to_be_signed
 *   Syntax: "POST <http-uri>\n<client-id>.<request-time>.<request-body>"
 *   Example:
 *     POST /ams/api/v1/payments/pay
 *     SANDBOX_5X00000000000000.1685599933871.{"env":...}
 *
 * Step 2: Generate the signature
 *   generated_signature = urlEncode(base64Encode(sha256withRSA(content_to_be_signed, privateKey)))
 *
 * @param httpUri      domain part excluded, e.g. /ams/api/v1/payments/pay
 * @param clientId     e.g. SANDBOX_5X00000000000000
 * @param requestTime  timestamp in milliseconds, e.g. 1685599933871
 * @param requestBody  JSON request body string
 * @param privateKeyBase64  Base64-encoded PKCS#8 private key
 * @returns URL-encoded signature string
 */
export function signRequest(
  httpUri: string,
  clientId: string,
  requestTime: string,
  requestBody: string,
  privateKeyBase64: string
): string {
  // Step 1: Construct content_to_be_signed
  // Format: "POST <http-uri>\n<client-id>.<request-time>.<request-body>"
  const contentToSign = `POST ${httpUri}\n${clientId}.${requestTime}.${requestBody}`;

  // Step 2: sha256withRSA -> base64Encode -> urlEncode
  const privateKeyPem = formatPrivateKey(privateKeyBase64);
  const signer = crypto.createSign('SHA256');
  signer.update(contentToSign, 'utf8');

  // base64Encode(sha256withRSA(content_to_be_signed, privateKey))
  const base64Signature = signer.sign(privateKeyPem, 'base64');

  // urlEncode(base64EncodedSignature)
  return encodeURIComponent(base64Signature);
}

/**
 * Verify a signature from Antom response or notification.
 *
 * content_to_be_validated = "POST <httpUri>\n<clientId>.<time>.<body>"
 * verify = sha256withRSA_verify(base64Decode(urlDecode(targetSignature)), content, publicKey)
 */
export function verifySignature(
  httpUri: string,
  clientId: string,
  time: string,
  body: string,
  targetSignature: string,
  publicKeyBase64: string
): boolean {
  const contentToVerify = `POST ${httpUri}\n${clientId}.${time}.${body}`;

  console.log(`[verifySignature] DEBUG - httpUri: ${httpUri}`);
  console.log(`[verifySignature] DEBUG - clientId: ${clientId}`);
  console.log(`[verifySignature] DEBUG - time: ${time}`);
  console.log(`[verifySignature] DEBUG - body length: ${body.length}`);
  console.log(`[verifySignature] DEBUG - contentToVerify (first 300 chars): ${contentToVerify.substring(0, 300)}`);
  console.log(`[verifySignature] DEBUG - targetSignature (first 80 chars): ${targetSignature.substring(0, 80)}...`);

  const verifier = crypto.createVerify('SHA256');
  verifier.update(contentToVerify, 'utf8');

  const publicKeyPem = formatPublicKey(publicKeyBase64);
  console.log(`[verifySignature] DEBUG - publicKeyPem header: ${publicKeyPem.split('\n')[0]}`);

  const urlDecoded = decodeURIComponent(targetSignature);
  console.log(`[verifySignature] DEBUG - urlDecoded signature (first 80 chars): ${urlDecoded.substring(0, 80)}...`);
  console.log(`[verifySignature] DEBUG - urlDecoded === targetSignature: ${urlDecoded === targetSignature}`);
  const decodedSig = Buffer.from(urlDecoded, 'base64');
  console.log(`[verifySignature] DEBUG - decoded signature buffer length: ${decodedSig.length}`);

  try {
    const result = verifier.verify(publicKeyPem, decodedSig);
    console.log(`[verifySignature] DEBUG - verify result: ${result}`);
    return result;
  } catch (err) {
    console.error(`[verifySignature] DEBUG - verify threw error:`, err);
    return false;
  }
}

/**
 * Parse the Signature header value.
 * Format: "algorithm=RSA256, keyVersion=1, signature=<value>"
 */
export function parseSignatureHeader(header: string): {
  algorithm: string;
  keyVersion: string;
  signature: string;
} | null {
  const parts: Record<string, string> = {};
  // Remove the "Signature: " prefix if present
  const cleaned = header.replace(/^Signature:\s*/i, '');
  const segments = cleaned.split(',').map((s) => s.trim());
  for (const seg of segments) {
    const eqIdx = seg.indexOf('=');
    if (eqIdx > 0) {
      const key = seg.substring(0, eqIdx).trim();
      const val = seg.substring(eqIdx + 1).trim();
      parts[key] = val;
    }
  }

  if (!parts.algorithm || !parts.keyVersion || !parts.signature) {
    return null;
  }

  return {
    algorithm: parts.algorithm,
    keyVersion: parts.keyVersion,
    signature: parts.signature,
  };
}

/**
 * Step 3: Build the Signature header value for outgoing requests.
 * Syntax: 'algorithm=<algorithm>, keyVersion=<key-version>, signature=<generatedSignature>'
 * Example: 'algorithm=RSA256, keyVersion=1, signature=SVCvBbh5Evi...'
 */
export function buildSignatureHeader(generatedSignature: string, keyVersion = '1'): string {
  return `algorithm=RSA256,keyVersion=${keyVersion},signature=${generatedSignature}`;
}

/**
 * Wrap a raw Base64 string into PEM format with 64-char line wrapping.
 */
function wrapBase64(base64: string, lineWidth = 64): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += lineWidth) {
    lines.push(base64.substring(i, i + lineWidth));
  }
  return lines.join('\n');
}

/**
 * Detect if a raw Base64-encoded private key is PKCS#8 format.
 * PKCS#8: SEQUENCE { INTEGER(version=0), SEQUENCE(AlgorithmIdentifier), OCTET STRING }
 * PKCS#1: SEQUENCE { INTEGER(version=0), INTEGER(modulus), ... }
 */
function isPkcs8PrivateKey(base64Key: string): boolean {
  try {
    const buf = Buffer.from(base64Key, 'base64');
    if (buf.length < 4) return false;
    let offset = 1; // skip SEQUENCE tag (0x30)
    // Parse length
    if (buf[offset]! & 0x80) {
      const lenBytes = buf[offset]! & 0x7f;
      offset += 1 + lenBytes;
    } else {
      offset += 1;
    }
    // First element: INTEGER (version = 0)
    if (buf[offset] === 0x02) {
      offset += 1;
      const intLen = buf[offset]!;
      offset += 1 + intLen;
      // PKCS#8: next is SEQUENCE (0x30), PKCS#1: next is INTEGER (0x02)
      if (offset < buf.length) {
        return buf[offset] === 0x30;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function formatPrivateKey(base64Key: string): string {
  // Strip PEM headers/footers if present, then extract pure Base64
  let cleaned = base64Key
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const wrapped = wrapBase64(cleaned);

  if (isPkcs8PrivateKey(cleaned)) {
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }
  return `-----BEGIN RSA PRIVATE KEY-----\n${wrapped}\n-----END RSA PRIVATE KEY-----`;
}

function formatPublicKey(base64Key: string): string {
  // Strip PEM headers/footers if present, then extract pure Base64
  let cleaned = base64Key
    .replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, '')
    .replace(/-----END (?:RSA )?PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');

  const wrapped = wrapBase64(cleaned);

  // Detect X.509 SubjectPublicKeyInfo vs PKCS#1 RSAPublicKey
  try {
    const buf = Buffer.from(cleaned, 'base64');
    let offset = 1;
    if (buf[offset]! & 0x80) {
      const lenBytes = buf[offset]! & 0x7f;
      offset += 1 + lenBytes;
    } else {
      offset += 1;
    }
    if (buf[offset] === 0x30) {
      return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
    }
    return `-----BEGIN RSA PUBLIC KEY-----\n${wrapped}\n-----END RSA PUBLIC KEY-----`;
  } catch {
    return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
  }
}
