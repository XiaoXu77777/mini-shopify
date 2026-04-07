"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const antomService_1 = require("../services/antomService");
const router = (0, express_1.Router)();
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
exports.default = router;
//# sourceMappingURL=wfAuth.js.map