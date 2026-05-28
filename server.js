const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const LICENSES_FILE = path.join(__dirname, 'licenses.json');
const SECRET_SALT = process.env.LICENSE_SECRET_SALT || 'ghost-profile-checker-default-salt';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

const PAYPAL_API = PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

function loadLicenses() {
  try {
    if (fs.existsSync(LICENSES_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading licenses:', e);
  }
  return [];
}

function saveLicenses(licenses) {
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(licenses, null, 2));
}

function generateLicenseKey(email) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  const data = `${timestamp}-${random}-${email}`;
  const hmac = crypto.createHmac('sha256', SECRET_SALT).update(data).digest('hex').substring(0, 8);
  const raw = `${timestamp}-${random}-${hmac}`;
  return raw.toUpperCase().match(/.{1,4}/g).join('-');
}

function validateLicenseKey(key) {
  const cleaned = key.replace(/-/g, '').toLowerCase();
  if (cleaned.length < 20) return false;
  const timestamp = cleaned.substring(0, 8);
  const random = cleaned.substring(8, 16);
  const hmac = cleaned.substring(16, 24);
  const licenses = loadLicenses();
  const match = licenses.find(l => l.key.replace(/-/g, '').toLowerCase() === cleaned);
  if (!match) return false;
  const data = `${timestamp}-${random}-${match.email}`;
  const expected = crypto.createHmac('sha256', SECRET_SALT).update(data).digest('hex').substring(0, 8);
  return hmac === expected && match.active !== false;
}

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

app.post('/api/create-order', async (req, res) => {
  try {
    const token = await getPayPalAccessToken();
    const resOrder = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: '9.99' },
          description: 'Ghost Profile Checker - Premium License',
        }],
      }),
    });
    const order = await resOrder.json();
    res.json({ id: order.id });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/api/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

    const token = await getPayPalAccessToken();
    const capRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const capture = await capRes.json();

    if (capture.status === 'COMPLETED') {
      const payerEmail = capture.payer.email_address;
      const licenseKey = generateLicenseKey(payerEmail);
      const licenses = loadLicenses();
      licenses.push({
        key: licenseKey,
        email: payerEmail,
        created: new Date().toISOString(),
        active: true,
        orderId,
      });
      saveLicenses(licenses);
      return res.json({ success: true, licenseKey, email: payerEmail });
    }
    res.status(400).json({ error: 'Payment not completed', status: capture.status });
  } catch (err) {
    console.error('Capture error:', err);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

app.post('/api/validate-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, error: 'Missing key' });
  res.json({ valid: validateLicenseKey(key) });
});

app.get('/payment.html', (req, res) => {
  const filePath = path.join(__dirname, 'payment.html');
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace('{{PAYPAL_CLIENT_ID}}', PAYPAL_CLIENT_ID);
  res.send(html);
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ghost Profile Checker server running on port ${PORT} (${PAYPAL_MODE})`);
});
