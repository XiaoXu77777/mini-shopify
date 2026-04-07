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
 * Detect private key type from raw Base64 content:
 * - PKCS#8 starts with ASN.1 SEQUENCE → version INTEGER 0 → AlgorithmIdentifier
 *   Typical Base64 prefix: "MIIEv" / "MIIE" with 3rd byte being version=0 (encoded differently)
 * - PKCS#1 (RSAPrivateKey) starts with ASN.1 SEQUENCE → version INTEGER 0 → modulus INTEGER
 *   Typical Base64 prefix: "MIIEow" / "MIIEpA" etc. where decoded bytes show 02 01 00 02 82...
 *
 * A reliable heuristic: decode first few bytes and check ASN.1 structure.
 * PKCS#8 has OID 1.2.840.113549.1.1.1 (RSA) at offset ~7-9.
 * PKCS#1 has INTEGER (tag 0x02) at offset 4.
 */
function isPkcs8PrivateKey(base64Key: string): boolean {
  try {
    const buf = Buffer.from(base64Key, 'base64');
    // PKCS#8 PrivateKeyInfo: SEQUENCE { INTEGER (version), AlgorithmIdentifier { OID ... }, OCTET STRING }
    // After the outer SEQUENCE tag+length, PKCS#8 has INTEGER version (0) then another SEQUENCE (AlgorithmIdentifier).
    // PKCS#1 RSAPrivateKey: SEQUENCE { INTEGER (version=0), INTEGER (modulus), ... }
    // After the outer SEQUENCE tag+length, PKCS#1 has INTEGER tag (0x02).
    //
    // Find the first tag after the outer SEQUENCE header:
    if (buf.length < 4) return false;
    let offset = 1; // skip SEQUENCE tag (0x30)
    // Parse length
    if (buf[offset]! & 0x80) {
      const lenBytes = buf[offset]! & 0x7f;
      offset += 1 + lenBytes;
    } else {
      offset += 1;
    }
    // Now at first element inside SEQUENCE
    // PKCS#8: first element is INTEGER (version = 0), tag 0x02, value 0x00
    // Then second element is SEQUENCE (AlgorithmIdentifier), tag 0x30
    if (buf[offset] === 0x02) {
      // It's an INTEGER, skip it to see what's next
      offset += 1;
      const intLen = buf[offset]!;
      offset += 1 + intLen;
      // If next tag is SEQUENCE (0x30), it's PKCS#8
      // If next tag is INTEGER (0x02), it's PKCS#1
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
  const cleaned = base64Key.replace(/\s/g, '');
  if (cleaned.startsWith('-----BEGIN')) return base64Key;

  const wrapped = wrapBase64(cleaned);
  if (isPkcs8PrivateKey(cleaned)) {
    return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }
  // Default to PKCS#1 RSA private key
  return `-----BEGIN RSA PRIVATE KEY-----\n${wrapped}\n-----END RSA PRIVATE KEY-----`;
}

function formatPublicKey(base64Key: string): string {
  const cleaned = base64Key.replace(/\s/g, '');
  if (cleaned.startsWith('-----BEGIN')) return base64Key;

  const wrapped = wrapBase64(cleaned);
  // Check if it's X.509 SubjectPublicKeyInfo (starts with SEQUENCE containing AlgorithmIdentifier)
  // MIIBIjANBgkq... is X.509 format, MIIBCgKCAQEA... would be PKCS#1 RSA public key
  try {
    const buf = Buffer.from(cleaned, 'base64');
    let offset = 1;
    if (buf[offset]! & 0x80) {
      const lenBytes = buf[offset]! & 0x7f;
      offset += 1 + lenBytes;
    } else {
      offset += 1;
    }
    // X.509 SubjectPublicKeyInfo: SEQUENCE { SEQUENCE (AlgorithmIdentifier), BIT STRING }
    // PKCS#1 RSAPublicKey: SEQUENCE { INTEGER (modulus), INTEGER (exponent) }
    if (buf[offset] === 0x30) {
      // Next element is SEQUENCE → X.509 format
      return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
    }
    // PKCS#1 RSA public key
    return `-----BEGIN RSA PUBLIC KEY-----\n${wrapped}\n-----END RSA PUBLIC KEY-----`;
  } catch {
    // Fallback to X.509 format
    return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
  }
}
