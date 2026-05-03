const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// MoMo test credentials
const partnerCode = "MOMO";
const accessKey = "F8BBA842ECF85";
const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
const endpoint = "https://test-payment.momo.vn/v2/gateway/api/create";

app.get('/health', (req, res) => {
    res.json({ status: 'up', service: 'payment' });
});

app.post('/create-payment', async (req, res) => {
    const { orderId, amount, returnUrl, orderInfo } = req.body;

    if (!orderId || !amount || !returnUrl) {
        return res.status(400).json({ error: "orderId, amount, and returnUrl are required" });
    }

    const requestId = orderId;
    const notifyUrl = returnUrl;
    const requestType = "captureWallet";
    const extraData = "";

    // Generate signature
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${notifyUrl}&orderId=${orderId}&orderInfo=${orderInfo || 'Thanh toan ve'}&partnerCode=${partnerCode}&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

    const requestBody = {
        partnerCode: partnerCode,
        partnerName: "Test",
        storeId: "MomoTestStore",
        requestId: requestId,
        amount: amount,
        orderId: orderId,
        orderInfo: orderInfo || 'Thanh toan ve',
        redirectUrl: returnUrl,
        ipnUrl: notifyUrl,
        lang: "vi",
        requestType: requestType,
        autoCapture: true,
        extraData: extraData,
        signature: signature
    };

    try {
        const response = await axios.post(endpoint, requestBody);
        res.json({ payUrl: response.data.payUrl });
    } catch (error) {
        console.error("MoMo API error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to create MoMo payment" });
    }
});

// Mock payment: trả về URL tới trang demo của chính mình
app.post('/create-mock-payment', (req, res) => {
    const { orderId, amount, returnUrl } = req.body;

    if (!orderId || !amount || !returnUrl) {
        return res.status(400).json({ error: "orderId, amount, and returnUrl are required" });
    }

    const publicUrl = process.env.PAYMENT_PUBLIC_URL || `http://localhost:${PORT}`;
    const mockPayUrl = `${publicUrl}/mock-pay?orderId=${encodeURIComponent(orderId)}&amount=${amount}&returnUrl=${encodeURIComponent(returnUrl)}`;

    res.json({ payUrl: mockPayUrl });
});

// Trang mock thanh toán — giả lập giao diện MoMo
app.get('/mock-pay', (req, res) => {
    const { orderId, amount, returnUrl } = req.query;

    if (!orderId || !amount || !returnUrl) {
        return res.status(400).send('Missing parameters');
    }

    const successUrl = `${returnUrl}?resultCode=0&orderId=${encodeURIComponent(orderId)}&amount=${amount}&message=Thanh+cong&transId=${Date.now()}`;

    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>MoMo Thanh Toán</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh}
    .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.12);width:100%;max-width:420px;overflow:hidden}
    .header{background:#ae2070;color:#fff;padding:24px;text-align:center}
    .header .logo{font-size:36px}
    .header h2{font-size:20px;margin-top:8px}
    .body{padding:28px}
    .badge{display:inline-block;background:#fff3cd;color:#856404;font-size:11px;font-weight:700;padding:2px 10px;border-radius:99px;border:1px solid #ffc107;margin-bottom:16px}
    .amount-box{background:#fdf0f6;border:1px solid #f0c0d8;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px}
    .amount-box .label{font-size:13px;color:#888;margin-bottom:4px}
    .amount-box .value{font-size:28px;font-weight:700;color:#ae2070}
    .field{margin-bottom:14px}
    .field label{display:block;font-size:13px;color:#555;font-weight:600;margin-bottom:6px}
    .field input{width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;outline:none}
    .field input:focus{border-color:#ae2070}
    .row{display:flex;gap:12px}
    .row .field{flex:1}
    .btn{width:100%;padding:14px;background:#ae2070;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;transition:background .2s}
    .btn:hover{background:#8b1a5a}
    .note{text-align:center;font-size:12px;color:#aaa;margin-top:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">💜</div>
      <h2>Thanh toán MoMo</h2>
    </div>
    <div class="body">
      <div style="text-align:center"><span class="badge">SANDBOX MODE</span></div>
      <div class="amount-box">
        <div class="label">Số tiền thanh toán</div>
        <div class="value">${Number(amount).toLocaleString('vi-VN')} đ</div>
      </div>
      <div class="field">
        <label>Số thẻ ATM</label>
        <input type="text" value="9704 0000 0000 0018"/>
      </div>
      <div class="field">
        <label>Tên chủ thẻ</label>
        <input type="text" value="NGUYEN VAN A"/>
      </div>
      <div class="row">
        <div class="field">
          <label>Ngày phát hành</label>
          <input type="text" value="03/07"/>
        </div>
        <div class="field">
          <label>Số điện thoại</label>
          <input type="text" placeholder="0912345678"/>
        </div>
      </div>
      <button class="btn" onclick="window.location.href='${successUrl}'">🔒 Thanh Toán</button>
      <p class="note">Nhấn "Thanh Toán" để hoàn tất giao dịch thử nghiệm</p>
    </div>
  </div>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`🚀 Payment service listening on port ${PORT}`);
});
