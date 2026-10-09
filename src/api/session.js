const SESSION_KEY = 'duesflow.session.v2';
function readSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) ?? null; } catch { return null; }
}
let session = readSession();
if (!session?.accessToken || !session?.user?.id) session = null;
const listeners = new Set();
export const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const getSession = () => session;
function emit() { listeners.forEach((listener) => listener()); }
export function setSession(next) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(next)); session = next; emit(); }
export function logout() { sessionStorage.removeItem(SESSION_KEY); session = null; emit(); }