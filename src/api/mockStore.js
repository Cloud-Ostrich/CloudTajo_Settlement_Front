// Mock 영속성 전용. 컴포넌트는 endpoints.js의 계약 API를 사용합니다.
import { DEFAULT_REQUESTS, normalizeRequest } from './mockRequests.js';
const KEY = 'duesflow.receipts.v2';
function read(storage, key, fallback) { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } }
const stored = read(localStorage, KEY, read(localStorage, 'duesflow.receipts.v1', DEFAULT_REQUESTS));
let receipts = (Array.isArray(stored) ? stored : DEFAULT_REQUESTS).filter(Boolean).map(normalizeRequest);
let revision = 0;
const listeners = new Set();
export const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getRevision = () => revision;
export const invalidateQueries = () => emit();
function emit() { revision++; listeners.forEach((listener) => listener()); }
export const readReceipts = () => receipts;
export function writeReceipts(next) { localStorage.setItem(KEY, JSON.stringify(next)); receipts = next; emit(); }
