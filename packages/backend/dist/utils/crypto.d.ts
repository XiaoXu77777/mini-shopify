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
export declare function signRequest(httpUri: string, clientId: string, requestTime: string, requestBody: string, privateKeyBase64: string): string;
/**
 * Verify a signature from Antom response or notification.
 *
 * Per Antom docs (Handle a response / Handle a notification):
 *   content_to_be_validated = "<httpMethod> <httpUri>\n<clientId>.<responseTime>.<responseBody>"
 *   verify = sha256withRSA_verify(base64Decode(urlDecode(targetSignature)), content, publicKey)
 *
 * Note: The targetSignature from Antom may or may not be URL-encoded.
 * We attempt URL-decode first, but if it looks like plain Base64, we use it directly.
 */
export declare function verifySignature(httpUri: string, clientId: string, time: string, body: string, targetSignature: string, publicKeyBase64: string): boolean;
/**
 * Parse the Signature header value.
 * Format: "algorithm=RSA256, keyVersion=1, signature=<value>"
 *
 * Note: The signature value itself may contain '=' (Base64 padding) and potentially
 * other special characters, so we must be careful not to split on those.
 * We find the "signature=" key and take everything after it as the signature value.
 */
export declare function parseSignatureHeader(header: string): {
    algorithm: string;
    keyVersion: string;
    signature: string;
} | null;
/**
 * Step 3: Build the Signature header value for outgoing requests.
 * Syntax: 'algorithm=<algorithm>, keyVersion=<key-version>, signature=<generatedSignature>'
 * Example: 'algorithm=RSA256, keyVersion=1, signature=SVCvBbh5Evi...'
 */
export declare function buildSignatureHeader(generatedSignature: string, keyVersion?: string): string;
//# sourceMappingURL=crypto.d.ts.map