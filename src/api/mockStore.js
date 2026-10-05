// Mock 영속성 전용. 컴포넌트는 endpoints.js의 계약 API를 사용합니다.
import { DEFAULT_REQUESTS, normalizeRequest } from './mockRequests.js';
const KEY = 'duesflow.receipts.v2';
const SESSION_KEY = 'duesflow.session.v2';
function read(storage, key, fallback) { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } }
const stored = read(localStorage, KEY, read(localStorage, 'duesflow.receipts.v1', DEFAULT_REQUESTS));
let receipts = (Array.isArray(stored) ? stored : DEFAULT_REQUESTS).filter(Boolean).map(normalizeRequest);
let session = read(sessionStorage, SESSION_KEY, null);
if (!session?.accessToken || !session?.user?.id) session = null;
let revision = 0;
const listeners = new Set();
export const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getRevision = () => revision;
export const getSession = () => session;
export const invalidateQueries = () => emit();
function emit() { revision++; listeners.forEach((listener) => listener()); }
export function setSession(next) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); session = next; emit(); }
export function logout() { sessionStorage.removeItem(SESSION_KEY); session = null; emit(); }
export const readReceipts = () => receipts;
export function writeReceipts(next) { localStorage.setItem(KEY, JSON.stringify(next)); receipts = next; emit(); }
