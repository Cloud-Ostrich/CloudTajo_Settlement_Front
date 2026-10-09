export const STATUS_LABELS = { SUBMITTED: '제출 완료', OCR_PENDING: 'OCR 처리 중', OCR_DONE: 'OCR 완료', REVIEWING: '검토 중', APPROVED: '승인', REJECTED: '반려', SETTLED: '정산 완료' };
export const CATEGORIES = [
  { id: 1, name: '식비', description: '식사 및 음료', active: true },
  { id: 2, name: '교통비', description: '교통 및 이동', active: true },
  { id: 3, name: '인쇄비', description: '인쇄 및 제작', active: true },
  { id: 4, name: '소모품비', description: '운영 소모품', active: true },
  { id: 5, name: '기타', description: '기타 지출', active: true },
];
export const HISTORY_ACTION_LABELS = {
  SUBMIT: '영수증 제출', SUBMITTED: '영수증 제출',
  OCR_PENDING: '영수증 인식 대기', OCR_DONE: '영수증 인식 완료', OCR_COMPLETED: '영수증 인식 완료',
  REVIEW: '관리자 검토', REVIEWING: '관리자 검토',
  EDIT_OCR: '영수증 인식 정보 수정', OCR_UPDATED: '영수증 인식 정보 수정',
  OCR_RETRY_REQUESTED: 'OCR 재처리 요청',
  APPROVE: '승인 완료', APPROVED: '승인 완료',
  REJECT: '반려', REJECTED: '반려',
  SETTLE: '정산 완료', SETTLED: '정산 완료',
};
export const historyActionLabel = (action) => HISTORY_ACTION_LABELS[action] || action;
export const RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
export const REVIEWABLE = ['OCR_DONE', 'REVIEWING'];
export const money = (value) => value == null ? '인식 대기' : `${value.toLocaleString('ko-KR')}원`;
export const receiptIdOf = (receipt) => receipt?.receiptId ?? receipt?.id;
export function categoryNameFor(receipt, categories) {
  if (receipt?.categoryName) return receipt.categoryName;
  return categories?.find((category) => category.id === receipt?.categoryId)?.name || '카테고리 정보 없음';
}
export function shiftMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  const absoluteMonth = year * 12 + monthNumber - 1 + offset;
  const shiftedYear = Math.floor(absoluteMonth / 12);
  const shiftedMonth = ((absoluteMonth % 12) + 12) % 12 + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}`;
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

export const SUBMISSION_SUMMARIES = [
  { key: 'processing', label: '처리 중', statuses: ['SUBMITTED', 'OCR_PENDING', 'OCR_DONE', 'REVIEWING'] },
  { key: 'APPROVED', label: '승인', statuses: ['APPROVED'] },
  { key: 'REJECTED', label: '반려', statuses: ['REJECTED'] },
  { key: 'SETTLED', label: '정산 완료', statuses: ['SETTLED'] },
];
export function matchesSubmissionFilter(receipt, filter) {
  if (filter === 'all') return true;
  const summary = SUBMISSION_SUMMARIES.find((item) => item.key === filter);
  return summary ? summary.statuses.includes(receipt.status) : receipt.status === filter;
}
