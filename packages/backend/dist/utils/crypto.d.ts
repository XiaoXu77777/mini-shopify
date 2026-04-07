/**
 * Sign a request to Antom API.
 *
 * content_to_be_signed = "POST <httpUri>\n<clientId>.<requestTime>.<requestBody>"
 * signature = urlEncode(base64Encode(sha256withRSA(content, privateKey)))
 */
export declare function signRequest(httpUri: string, clientId: string, requestTime: string, requestBody: string, privateKeyBase64: string): string;
/**
 * Verify a signature from Antom response or notification.
 *
 * content_to_be_validated = "POST <httpUri>\n<clientId>.<time>.<body>"
 * verify = sha256withRSA_verify(base64Decode(urlDecode(targetSignature)), content, publicKey)
 */
export declare function verifySignature(httpUri: string, clientId: string, time: string, body: string, targetSignature: string, publicKeyBase64: string): boolean;
/**
 * Parse the Signature header value.
 * Format: "algorithm=RSA256, keyVersion=1, signature=<value>"
 */
export declare function parseSignatureHeader(header: string): {
    algorithm: string;
    keyVersion: string;
    signature: string;
} | null;
/**
 * Build the Signature header value for outgoing requests.
 */
export declare function buildSignatureHeader(generatedSignature: string, keyVersion?: string): string;
//# sourceMappingURL=crypto.d.ts.map