import crypto from 'crypto';

/**
 * Sign a request to Antom API.
 *
 * content_to_be_signed = "POST <httpUri>\n<clientId>.<requestTime>.<requestBody>"
 * signature = urlEncode(base64Encode(sha256withRSA(content, privateKey)))
 */
export function signRequest(
  httpUri: string,
  clientId: string,
  requestTime: string,
  requestBody: string,
  privateKeyBase64: string
): string {
  const contentToSign = `POST ${httpUri}\n${clientId}.${requestTime}.${requestBody}`;

  const signer = crypto.createSign('SHA256');
  signer.update(contentToSign, 'utf8');

  const privateKeyPem = formatPrivateKey(privateKeyBase64);
  const signature = signer.sign(privateKeyPem, 'base64');

  return encodeURIComponent(signature);
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

  const verifier = crypto.createVerify('SHA256');
  verifier.update(contentToVerify, 'utf8');

  const publicKeyPem = formatPublicKey(publicKeyBase64);
  const decodedSig = Buffer.from(decodeURIComponent(targetSignature), 'base64');

  return verifier.verify(publicKeyPem, decodedSig);
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
 * Build the Signature header value for outgoing requests.
 */
export function buildSignatureHeader(generatedSignature: string, keyVersion = '1'): string {
  return `algorithm=RSA256, keyVersion=${keyVersion}, signature=${generatedSignature}`;
}

function formatPrivateKey(base64Key: string): string {
  const cleaned = base64Key.replace(/\s/g, '');
  if (cleaned.startsWith('-----BEGIN')) return base64Key;
  return `-----BEGIN PRIVATE KEY-----\n${cleaned}\n-----END PRIVATE KEY-----`;
}

function formatPublicKey(base64Key: string): string {
  const cleaned = base64Key.replace(/\s/g, '');
  if (cleaned.startsWith('-----BEGIN')) return base64Key;
  return `-----BEGIN PUBLIC KEY-----\n${cleaned}\n-----END PUBLIC KEY-----`;
}
