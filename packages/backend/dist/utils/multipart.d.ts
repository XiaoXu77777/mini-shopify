export interface ParsedMultipartFile {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
}
/**
 * Parse a buffered multipart request with Node's standards-based FormData parser.
 * The caller is responsible for enforcing the request-size limit before buffering.
 */
export declare function parseMultipartFile(contentType: string, rawBody: Buffer): Promise<ParsedMultipartFile>;
//# sourceMappingURL=multipart.d.ts.map