"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const antomService_1 = require("../services/antomService");
const config_1 = require("../utils/config");
const router = (0, express_1.Router)();
// In-memory store for OAuth state (in production, use Redis or database)
const oauthStateStore = new Map();
// Clean up old states every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [state, data] of oauthStateStore.entries()) {
        if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes expiry
            oauthStateStore.delete(state);
        }
    }
}, 5 * 60 * 1000);
// Mock WF KYB data that will be returned on OAuth callback
// Field names must match KYC form fields in frontend WizardData
const MOCK_WF_KYB_DATA = {
    // Company info
    legalName: 'Mock Corp Ltd.',
    companyType: 'ENTERPRISE',
    certificateType: 'ENTERPRISE_REGISTRATION',
    certificateNo: 'MOCK_BL_91310000XXXXXXXX',
    branchName: 'Head Office',
    companyUnit: 'HEADQUARTERS',
    // Registered address
    addressRegion: 'CN',
    addressState: 'Shanghai',
    addressCity: 'Shanghai',
    address1: '123 Mock Street',
    address2: '',
    zipCode: '200000',
    // Business info
    appName: 'Mock Store',
    merchantBrandName: 'MockBrand',
    mcc: '5021',
    doingBusinessAs: 'Mock Corp',
    websiteUrl: 'https://mock-corp.example.com',
    englishName: 'Mock Corp Ltd.',
    serviceDescription: 'Mock e-commerce services',
    // Contact
    contactType: 'PHONE_NO',
    contactInfo: '+86-21-12345678',
    // Legal representative
    legalRepName: '张三',
    legalRepIdType: 'ID_CARD',
    legalRepIdNo: '310101199001011234',
    legalRepDob: '1990-01-01',
};
// GET /api/wf/login - WorldFirst 登录页面（Step 1: Login）
router.get('/login', (_req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WorldFirst Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 16px;
      padding: 40px;
      width: 400px;
      text-align: center;
    }
    .logo {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      background: linear-gradient(90deg, #00b4d8, #0077b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle { color: rgba(255,255,255,0.6); margin-bottom: 32px; font-size: 14px; }
    .field {
      margin-bottom: 16px;
      text-align: left;
    }
    .field label {
      display: block;
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      margin-bottom: 6px;
    }
    .field input {
      width: 100%;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.08);
      color: #fff;
      font-size: 14px;
    }
    .btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(90deg, #00b4d8, #0077b6);
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 16px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.3);
      margin-top: 12px;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.1); }
    .info {
      margin-top: 20px;
      font-size: 12px;
      color: rgba(255,255,255,0.4);
    }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 16px 0;
      text-align: left;
      font-size: 13px;
      color: rgba(255,255,255,0.7);
    }
    .checkbox-row input {
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">WorldFirst</div>
    <div class="subtitle">Log in to connect your account with Shopify</div>
    <div class="field">
      <label>Email</label>
      <input type="email" id="email" value="merchant@example.com" />
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="password" value="••••••••" />
    </div>
    <div class="checkbox-row">
      <input type="checkbox" id="agree" checked />
      <label for="agree">
        I authorize Shopify Payments to access my KYB information and transaction data for merchant registration.
      </label>
    </div>
    <button class="btn" onclick="login()">Log In & Authorize</button>
    <button class="btn btn-secondary" onclick="goToSignUp()">Create a WorldFirst Account</button>
    <div class="info">This is a simulated WorldFirst login flow for demo purposes.</div>
  </div>
  <script>
    function generateAccessToken() {
      return 'WF_ACCESS_TOKEN_' + Math.random().toString(36).substr(2, 32);
    }
    
    function login() {
      const accessToken = generateAccessToken();
      const customerId = 'CUSTOMER_' + Math.random().toString(36).substr(2, 8).toUpperCase();
      const wfAccountId = 'WF_${(0, uuid_1.v4)().substring(0, 8)}';
      
      const data = {
        type: 'WF_LOGIN_SUCCESS',
        wfAccountId: wfAccountId,
        accessToken: accessToken,
        customerId: customerId
      };
      
      const msg = { ...data };
      if (window.opener) {
        window.opener.postMessage(msg, '*');
        window.close();
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    }
    
    function goToSignUp() {
      const signUpUrl = 'https://www.worldfirst.com/uk/?utm_medium=cpc&utm_source=google&utm_campaign=CPC_google_monks_us_brand_worldfirst&utm_term=CPC_US_Brand_worldfirst&utm_content=[WorldFirst]&utm_date=295279591102&gad_so';
      window.open(signUpUrl, '_blank');
    }
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});
// GET /api/wf/authorize - Legacy route, redirect to login
router.get('/authorize', (_req, res) => {
    res.redirect('/api/wf/login');
});
// POST /api/wf/query-kyb - Query KYB information from Antom using WF access token
router.post('/query-kyb', async (req, res) => {
    try {
        const { accessToken, customerId } = req.body;
        if (!accessToken || !customerId) {
            res.status(400).json({
                success: false,
                error: 'accessToken and customerId are required'
            });
            return;
        }
        const result = await antomService_1.antomService.queryKybInfo(accessToken, customerId);
        if (result.success) {
            res.json({
                success: true,
                kybData: result.kybData
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }
    }
    catch (err) {
        console.error('[WF] Query KYB error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to query KYB information'
        });
    }
});
// POST /api/wf/oauth-url - Get WorldFirst OAuth URL
router.post('/oauth-url', async (req, res) => {
    try {
        const { merchantId } = req.body;
        if (!merchantId) {
            res.status(400).json({
                success: false,
                error: 'merchantId is required'
            });
            return;
        }
        // Generate unique state and request IDs
        const state = (0, uuid_1.v4)();
        const requestId = (0, uuid_1.v4)();
        // Store state with merchantId
        oauthStateStore.set(state, { merchantId, timestamp: Date.now() });
        // Build OAuth URL with required parameters
        // Note: In production, these values should come from environment variables or database
        const oauthClientId = config_1.config.wf?.oauthClientId || '2188120328356641';
        const referenceCustomerId = `MERCHANT_${merchantId}`;
        // Build redirect URL (should point to frontend callback)
        const redirectUrl = `${config_1.config.frontendUrl || 'https://minishopify.xyz'}/merchants/${merchantId}/setup-payments`;
        // Build extendInfo with store details
        const extendInfo = {
            storeName: 'MiniShopify Store',
            currency: 'USD,GBP,EUR,CAD,CNH,AUD,SGD,JPY,NZD,HKD',
        };
        // Build the OAuth URL
        const baseUrl = 'https://portal.worldfirst.com/auth/shopifyMock';
        const params = new URLSearchParams({
            oauthClientId,
            scopes: 'SCOPE_USER_ACCOUNT_CREATE,SCOPE_AUTH_QUERY_MERCHANT_INFO',
            extendInfo: JSON.stringify(extendInfo),
            referenceCustomerId,
            requestId,
            redirectURL: redirectUrl,
            state,
            signature: 'wMSXz76VJCpn7zYlI8E%2B%2Bw%3D%3D', // In production, generate proper signature
        });
        const oauthUrl = `${baseUrl}?${params.toString()}`;
        res.json({
            success: true,
            oauthUrl
        });
    }
    catch (err) {
        console.error('[WF] Generate OAuth URL error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to generate OAuth URL'
        });
    }
});
// POST /api/wf/exchange-token - Exchange authCode for accessToken
router.post('/exchange-token', async (req, res) => {
    try {
        const { authCode } = req.body;
        if (!authCode) {
            res.status(400).json({
                success: false,
                error: 'authCode is required'
            });
            return;
        }
        // In mock mode, generate mock tokens
        if (config_1.config.mockMode) {
            const accessToken = `WF_ACCESS_TOKEN_${(0, uuid_1.v4)().replace(/-/g, '')}`;
            const customerId = `CUSTOMER_${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
            const wfAccountId = `WF_${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
            res.json({
                success: true,
                accessToken,
                customerId,
                wfAccountId
            });
            return;
        }
        // In production, call WorldFirst API to exchange authCode for accessToken
        // POST https://portal.worldfirst.com/api/oauth/token
        // Reference: https://docs.antom.com/ac/isv/apply_token_wf
        try {
            const tokenUrl = 'https://portal.worldfirst.com/api/oauth/token';
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    grantType: 'AUTHORIZATION_CODE',
                    authCode,
                    clientId: config_1.config.wf?.oauthClientId,
                    clientSecret: config_1.config.wf?.oauthClientSecret,
                }),
            });
            if (!response.ok) {
                throw new Error(`Token exchange failed: ${response.status}`);
            }
            const data = await response.json();
            res.json({
                success: true,
                accessToken: data.accessToken,
                customerId: data.customerId,
                wfAccountId: data.wfAccountId
            });
        }
        catch (apiErr) {
            console.error('[WF] Token exchange API error:', apiErr);
            res.status(500).json({
                success: false,
                error: 'Failed to exchange authorization code'
            });
        }
    }
    catch (err) {
        console.error('[WF] Exchange token error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to exchange authorization code'
        });
    }
});
// GET /api/wf/oauth-callback - Handle OAuth callback from WorldFirst
router.get('/oauth-callback', async (req, res) => {
    try {
        const { authCode, state, error } = req.query;
        if (error) {
            res.status(400).json({
                success: false,
                error: `OAuth error: ${error}`
            });
            return;
        }
        if (!authCode || !state) {
            res.status(400).json({
                success: false,
                error: 'authCode and state are required'
            });
            return;
        }
        // Verify state
        const stateData = oauthStateStore.get(state);
        if (!stateData) {
            res.status(400).json({
                success: false,
                error: 'Invalid or expired state'
            });
            return;
        }
        // Clean up used state
        oauthStateStore.delete(state);
        // Redirect to frontend with authCode
        const redirectUrl = `${config_1.config.frontendUrl || 'https://minishopify.xyz'}/merchants/${stateData.merchantId}/setup-payments?authCode=${authCode}&state=${state}`;
        res.redirect(redirectUrl);
    }
    catch (err) {
        console.error('[WF] OAuth callback error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to process OAuth callback'
        });
    }
});
exports.default = router;
//# sourceMappingURL=wfAuth.js.map