import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { receiptIdOf } from '../api/contracts';

const completedStatuses = new Set(['OCR_DONE', 'REVIEWING', 'APPROVED', 'REJECTED', 'SETTLED']);
export function receiptPreviewValues(receipt, detail) {
  return {
    merchantName: receipt.merchantName ?? detail?.merchantName ?? receipt.ocrResult?.merchantNameRaw ?? detail?.ocrResult?.merchantNameRaw,
    paidAt: receipt.paidAt ?? detail?.paidAt ?? receipt.ocrResult?.paidAtRaw ?? detail?.ocrResult?.paidAtRaw,
    amount: receipt.amount ?? detail?.amount ?? receipt.ocrResult?.amountRaw ?? detail?.ocrResult?.amountRaw,
  };
}

// Cache only for the current list response; mutations/reloads replace it.
export function useAdminReceiptPreviews(items, source) {
  const cache = useRef({ source: null, requests: new Map() });
  const [loaded, setLoaded] = useState({ source: null, details: new Map() });
  useEffect(() => {
    if (!source) return;
    if (cache.current.source !== source) cache.current = { source, requests: new Map() };
    const requests = cache.current.requests;
    const candidates = items.filter((item) => receiptIdOf(item) != null && completedStatuses.has(item.status)
      && Object.values(receiptPreviewValues(item)).some((value) => value == null));
    let active = true;
    let next = 0;
    async function worker() {
      while (active && next < candidates.length) {
        const item = candidates[next++];
        const id = receiptIdOf(item);
        if (!requests.has(id)) requests.set(id, apiRequest({ method: 'GET', url: `/receipts/${id}` }).then((response) => response.data).catch(() => null));
        const detail = await requests.get(id);
        if (active && detail) setLoaded((previous) => ({ source, details: new Map(previous.source === source ? previous.details : []).set(id, detail) }));
      }
    }
    for (let index = 0; index < Math.min(4, candidates.length); index++) void worker();
    return () => { active = false; };
  }, [items, source]);
  return loaded.source === source ? loaded.details : new Map();
}
