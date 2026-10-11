import { receiptIdOf, submitterLabel, categoryNameFor } from './contracts.js';
export function progressSteps(status, histories = []) {
  const labels = ['제출 완료', 'OCR 인식', '관리자 검토', '승인', '정산 완료'];
  const positions = { SUBMITTED: 1, OCR_PENDING: 1, OCR_DONE: 2, REVIEWING: 2, APPROVED: 4, SETTLED: 5 };
  const current = positions[status];
  return labels.map((label, index) => {
    if (status === 'REJECTED') {
      const evidence = index === 0 ? histories.some((h) => ['SUBMIT', 'SUBMITTED'].includes(h.action)) : index === 1 ? histories.some((h) => ['OCR_DONE', 'OCR_COMPLETED'].includes(h.action)) : false;
      return { label: index === 2 ? '관리자 검토 · 반려됨' : label, complete: evidence, current: index === 2, rejected: index === 2 };
    }
    return { label, complete: current != null && index < current, current: index === current, rejected: false };
  });
}
export function searchSortReceipts(items, query, order, categories) {
  const term = query.trim().toLocaleLowerCase();
  const result = items.filter((item) => [receiptIdOf(item), `#${receiptIdOf(item)}`, item.submitterId, submitterLabel(item), item.merchantName, item.purpose, categoryNameFor(item, categories)]
    .some((value) => value != null && String(value).toLocaleLowerCase().includes(term)));
  const amountOrder = order.startsWith('amount');
  const descending = order.endsWith('desc');
  return result.sort((a, b) => {
    const av = amountOrder ? a.amount : Date.parse(a.submittedAt ?? a.createdAt);
    const bv = amountOrder ? b.amount : Date.parse(b.submittedAt ?? b.createdAt);
    const validA = typeof av === 'number' && Number.isFinite(av), validB = typeof bv === 'number' && Number.isFinite(bv);
    if (!validA || !validB) return validA ? -1 : validB ? 1 : 0;
    return descending ? bv - av : av - bv;
  });
}

export function historyTimeLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '시각 정보 없음';
  return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}
