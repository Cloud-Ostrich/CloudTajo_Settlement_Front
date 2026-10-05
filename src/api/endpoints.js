import { apiRequest } from './client.js';
import { invalidateQueries, setSession } from './mockStore.js';
export async function login(email, password) {
  const response = await apiRequest({ method: 'POST', url: '/auth/login', data: { email, password } });
  setSession(response.data);
  return response;
}
export const getCategories = () => apiRequest({ method: 'GET', url: '/categories' });
export const getMyReceipts = () => apiRequest({ method: 'GET', url: '/receipts/my' });
export const getAdminReceipts = () => apiRequest({ method: 'GET', url: '/admin/receipts' });
export const getReceipt = (receiptId) => apiRequest({ method: 'GET', url: `/receipts/${receiptId}` });
export const getAdminSummary = (month) => apiRequest({ method: 'GET', url: '/admin/dashboard/summary', params: { month } });
export function submitReceipt({ image, purpose, categoryId, memo }) {
  const data = new FormData();
  data.append('image', image);
  data.append('purpose', purpose);
  data.append('categoryId', String(categoryId));
  if (memo) data.append('memo', memo);
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
