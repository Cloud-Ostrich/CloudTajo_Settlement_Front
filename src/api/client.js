import axios from 'axios';
import { mockAdapter } from './mockBackend.js';
import { getSession } from './mockStore.js';

// 현재는 Mock만 사용합니다. 추후 연결 절차는 docs/api-contract.md를 참고합니다.
export const apiClient = axios.create({ baseURL: '/api', adapter: mockAdapter });
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해주세요.',
  FORBIDDEN_ROLE: '접근 권한이 없습니다.',
  FORBIDDEN: '접근 권한이 없습니다.',
  UNAUTHORIZED: '로그인이 필요합니다. 다시 로그인해주세요.',
  FILE_UPLOAD_FAILED: '영수증 등록에 실패했습니다. 다시 시도해주세요.',
  OCR_FAILED: '영수증 인식에 실패했습니다. 다시 시도해주세요.',
  RECEIPT_NOT_FOUND: '정보를 불러오지 못했습니다. 다시 시도해주세요.',
  NOT_FOUND: '정보를 불러오지 못했습니다. 다시 시도해주세요.',
  INVALID_STATUS_TRANSITION: '처리에 실패했습니다. 다시 시도해주세요.',
  INVALID_STATUS: '처리에 실패했습니다. 다시 시도해주세요.',
};
function endpointFallback(config) {
  const method = config?.method?.toUpperCase();
  const endpoint = String(config?.url || '').split('?')[0];
  if (endpoint === '/auth/login') return '이메일 또는 비밀번호를 확인해주세요.';
  if (endpoint === '/receipts' && method === 'POST') return '영수증 등록에 실패했습니다. 다시 시도해주세요.';
  if (/\/ocr(?:\/retry)?$/.test(endpoint)) return '영수증 인식에 실패했습니다. 다시 시도해주세요.';
  if (method === 'GET') return '정보를 불러오지 못했습니다. 다시 시도해주세요.';
  if (endpoint.startsWith('/admin/')) return '처리에 실패했습니다. 다시 시도해주세요.';
  return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
}
function userMessage(errorCode, config) {
  if (errorCode === 'AUTH_REQUIRED') {
    return config?.url === '/auth/login' ? ERROR_MESSAGES.INVALID_CREDENTIALS : '로그인이 필요합니다. 다시 로그인해주세요.';
  }
  const contextualCodes = new Set(['VALIDATION_ERROR', 'INVALID_REQUEST', 'METHOD_NOT_ALLOWED', 'MOCK_STORAGE_ERROR', 'ERR_NETWORK', 'ERR_BAD_REQUEST', 'ERR_BAD_RESPONSE', 'ECONNABORTED']);
  if (errorCode && !ERROR_MESSAGES[errorCode] && !contextualCodes.has(errorCode)) return '오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  return ERROR_MESSAGES[errorCode] || endpointFallback(config);
}
function sanitizedMessage(message, config) {
  let result = String(message || '요청을 처리하지 못했습니다.');
  const authorization = config?.headers?.get?.('Authorization');
  if (authorization) result = result.replaceAll(authorization, '[REDACTED]');
  const body = config?.data;
  const sensitiveValues = [];
  if (body instanceof FormData) {
    for (const key of ['password', 'accessToken', 'token', 'authorization']) {
      const value = body.get(key);
      if (typeof value === 'string' && value) sensitiveValues.push(value);
    }
  } else if (body && typeof body === 'object') {
    for (const key of ['password', 'accessToken', 'token', 'authorization']) {
      if (typeof body[key] === 'string' && body[key]) sensitiveValues.push(body[key]);
    }
  } else if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      for (const key of ['password', 'accessToken', 'token', 'authorization']) {
        if (typeof parsed[key] === 'string' && parsed[key]) sensitiveValues.push(parsed[key]);
      }
    } catch {}
  }
  for (const value of sensitiveValues) result = result.replaceAll(value, '[REDACTED]');
  return result;
}
function reportFailure(config, status, errorCode, message) {
  console.error('[API request failed]', {
    endpoint: String(config?.url || '').split('?')[0],
    method: config?.method?.toUpperCase() || 'UNKNOWN',
    status: status ?? null,
    errorCode: errorCode || 'UNEXPECTED_API_ERROR',
    message: sanitizedMessage(message, config),
  });
}
function createApiError(config, response, errorCode, serverMessage) {
  reportFailure(config, response?.status, errorCode, serverMessage);
  return Object.assign(new Error(userMessage(errorCode, config)), {
    errorCode: errorCode || 'UNEXPECTED_API_ERROR', response, config, serverMessage,
  });
}
apiClient.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
apiClient.interceptors.response.use((response) => {
  if (response.data.success === false) {
    throw createApiError(response.config, response, response.data.errorCode, response.data.message);
  }
  return response;
}, (error) => {
  const failure = error.response?.data;
  const normalized = createApiError(error.config, error.response, failure?.errorCode || error.code || 'UNEXPECTED_API_ERROR', failure?.message || error.message);
  return Promise.reject(normalized);
});
export async function apiRequest(config) { return (await apiClient.request(config)).data; }
