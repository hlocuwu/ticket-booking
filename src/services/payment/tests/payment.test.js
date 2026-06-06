const request = require('supertest');
const app = require('../index');

jest.mock('axios');
const axios = require('axios');

describe('GET /health', () => {
    it('returns 200 with status up', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('up');
        expect(res.body.service).toBe('payment');
    });
});

describe('POST /create-mock-payment', () => {
    it('returns 400 when fields are missing', async () => {
        const res = await request(app).post('/create-mock-payment').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('returns 400 when amount is missing', async () => {
        const res = await request(app)
            .post('/create-mock-payment')
            .send({ orderId: 'ORD-1', returnUrl: 'http://localhost/result' });
        expect(res.status).toBe(400);
    });

    it('returns payUrl on valid request', async () => {
        const res = await request(app).post('/create-mock-payment').send({
            orderId: 'ORD-123',
            amount: 150000,
            returnUrl: 'http://localhost:3000/result',
        });
        expect(res.status).toBe(200);
        expect(res.body.payUrl).toMatch(/ORD-123/);
        expect(res.body.payUrl).toMatch(/150000/);
    });

    it('payUrl contains encoded returnUrl', async () => {
        const res = await request(app).post('/create-mock-payment').send({
            orderId: 'ORD-456',
            amount: 50000,
            returnUrl: 'http://localhost:3000/result',
        });
        expect(res.body.payUrl).toContain('returnUrl=');
    });
});

describe('GET /mock-pay', () => {
    it('returns 400 when params are missing', async () => {
        const res = await request(app).get('/mock-pay');
        expect(res.status).toBe(400);
    });

    it('returns HTML page with amount on valid params', async () => {
        const res = await request(app).get(
            '/mock-pay?orderId=ORD-1&amount=100000&returnUrl=http%3A%2F%2Flocalhost%2Fresult'
        );
        expect(res.status).toBe(200);
        expect(res.text).toContain('100');
        expect(res.text).toContain('Thanh');
    });
});

describe('POST /create-payment', () => {
    it('returns 400 when fields are missing', async () => {
        const res = await request(app).post('/create-payment').send({});
        expect(res.status).toBe(400);
    });

    it('returns payUrl on successful MoMo response', async () => {
        axios.post.mockResolvedValueOnce({
            data: { payUrl: 'https://test-payment.momo.vn/pay?token=abc' },
        });

        const res = await request(app).post('/create-payment').send({
            orderId: 'ORD-789',
            amount: 200000,
            returnUrl: 'http://localhost:3000/result',
        });
        expect(res.status).toBe(200);
        expect(res.body.payUrl).toBe('https://test-payment.momo.vn/pay?token=abc');
    });

    it('returns 500 when MoMo API fails', async () => {
        axios.post.mockRejectedValueOnce(new Error('network error'));

        const res = await request(app).post('/create-payment').send({
            orderId: 'ORD-ERR',
            amount: 100000,
            returnUrl: 'http://localhost:3000/result',
        });
        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
    });
});
