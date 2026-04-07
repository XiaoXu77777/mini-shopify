"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, _next) {
    console.error('[Error]', err.message, err.stack);
    res.status(500).json({
        error: err.message || 'Internal Server Error',
    });
}
//# sourceMappingURL=errorHandler.js.map