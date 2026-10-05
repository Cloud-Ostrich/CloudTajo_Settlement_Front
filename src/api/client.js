import axios from 'axios';
import { mockAdapter } from './mockBackend.js';
import { getSession } from './mockStore.js';

// 현재는 Mock만 사용합니다. 실제 연결 시 adapter 설정만 제거합니다.
export const apiClient = axios.create({ baseURL: '/api', adapter: mockAdapter });
apiClient.interceptors.request.use((config) => {
  const token = getSession()?.accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
apiClient.interceptors.response.use((response) => {
  if (response.data.success === false) {
    throw Object.assign(new Error(response.data.message), { errorCode: response.data.errorCode, response });
  }
  return response;
}, (error) => {
  const failure = error.response?.data;
  if (failure?.success === false) {
    error.message = failure.message;
    error.errorCode = failure.errorCode;
  }
  return Promise.reject(error);
});
export async function apiRequest(config) { return (await apiClient.request(config)).data; }
