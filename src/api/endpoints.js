import { apiRequest } from './client.js';
import { invalidateQueries } from './mockStore.js';
import { getSession, logout, setSession } from './session.js';
let sessionVerification = null;
export async function login(email, password) {
  const response = await apiRequest({ method: 'POST', url: '/auth/login', data: { email, password } });
  setSession(response.data);
  return response;
}
export const getCurrentUser = () => apiRequest({ method: 'GET', url: '/users/me' });
export function restoreSession() {
  const session = getSession();
  if (!session?.accessToken) return Promise.resolve(null);
  if (sessionVerification?.token === session.accessToken) return sessionVerification.promise;

  const token = session.accessToken;
  const request = getCurrentUser().then(({ data: user }) => {
    const activeSession = getSession();
    if (activeSession?.accessToken === token) setSession({ ...activeSession, user });
    return user;
  }).catch((error) => {
    const activeSession = getSession();
    const unauthorized = error.response?.status === 401 || ['AUTH_REQUIRED', 'UNAUTHORIZED'].includes(error.errorCode);
    if (activeSession?.accessToken === token && unauthorized) logout();
    throw error;
  });
  const sharedRequest = request.finally(() => {
    if (sessionVerification?.promise === sharedRequest) sessionVerification = null;
  });
  sessionVerification = { token, promise: sharedRequest };
  return sharedRequest;
}
export const getCategories = () => apiRequest({ method: 'GET', url: '/categories' });
export const getMyReceipts = (params = {}) => apiRequest({ method: 'GET', url: '/receipts/my', params });
export const getAdminReceipts = (params = {}) => apiRequest({ method: 'GET', url: '/admin/receipts', params });
export const getReceipt = (receiptId) => apiRequest({ method: 'GET', url: `/receipts/${receiptId}` });
export const retryOcr = (receiptId) => mutation({ method: 'POST', url: `/receipts/${receiptId}/ocr/retry` });
export const getReceiptHistories = (receiptId) => apiRequest({ method: 'GET', url: `/receipts/${receiptId}/histories` });
export const getReceiptDuplicates = (receiptId) => apiRequest({ method: 'GET', url: `/admin/receipts/${receiptId}/duplicates` });
export const getAdminSummary = (month) => apiRequest({ method: 'GET', url: '/admin/dashboard/summary', params: { month } });
export function submitReceipt({ image, purpose, categoryId, memo }) {
  const data = new FormData();
  data.append('image', image);
  data.append('purpose', purpose);
  data.append('categoryId', String(categoryId));
  data.append('memo', memo || '');
  return mutation({ method: 'POST', url: '/receipts', headers: { 'Content-Type': 'multipart/form-data' }, data });
}
async function mutation(config) {
  const response = await apiRequest(config);
  invalidateQueries();
  return response;
}
export const updateOcr = (id, data) => mutation({ method: 'PATCH', url: `/admin/receipts/${id}/ocr`, data });
export const approveReceipt = (id, data) => mutation({ method: 'POST', url: `/admin/receipts/${id}/approve`, data });
export const rejectReceipt = (id, data) => mutation({ method: 'POST', url: `/admin/receipts/${id}/reject`, data });
export const settleReceipt = (id, data) => mutation({ method: 'POST', url: `/admin/receipts/${id}/settle`, data });
