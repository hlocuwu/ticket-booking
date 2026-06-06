import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock axios before importing the module under test
vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  return {
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
      })),
    },
  };
});

describe('apiClient', () => {
  it('is created with the correct base URL from env', async () => {
    const axios = (await import('axios')).default;
    // Import triggers the axios.create calls
    await import('../services/apiClient');
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: '/api/auth' }));
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: '/api/events' }));
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: '/api/booking' }));
  });
});

describe('authService', () => {
  let mockClient;

  beforeEach(async () => {
    vi.resetModules();

    mockClient = {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    };

    vi.doMock('axios', () => ({
      default: { create: vi.fn(() => mockClient) },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('login posts credentials to /auth/login', async () => {
    mockClient.post.mockResolvedValue({ data: { token: 'tok123' } });
    const { authService } = await import('../services/authService');
    await authService.login({ username: 'alice', password: 'pass' });
    expect(mockClient.post).toHaveBeenCalledWith('/auth/login', {
      username: 'alice',
      password: 'pass',
    });
  });

  it('registerSendOtp posts to /auth/register/send-otp', async () => {
    mockClient.post.mockResolvedValue({ data: {} });
    const { authService } = await import('../services/authService');
    await authService.registerSendOtp({ username: 'u', email: 'u@t.com', password: 'p' });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/auth/register/send-otp',
      expect.objectContaining({ email: 'u@t.com' })
    );
  });

  it('registerVerify posts to /auth/register/verify', async () => {
    mockClient.post.mockResolvedValue({ data: {} });
    const { authService } = await import('../services/authService');
    await authService.registerVerify({ email: 'u@t.com', otp: '123456' });
    expect(mockClient.post).toHaveBeenCalledWith('/auth/register/verify', {
      email: 'u@t.com',
      otp: '123456',
    });
  });

  it('getProfile calls GET /auth/profile', async () => {
    mockClient.get.mockResolvedValue({ data: { username: 'alice' } });
    const { authService } = await import('../services/authService');
    const result = await authService.getProfile();
    expect(mockClient.get).toHaveBeenCalledWith('/auth/profile');
    expect(result).toEqual({ username: 'alice' });
  });
});
