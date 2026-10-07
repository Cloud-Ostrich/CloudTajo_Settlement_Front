export const STATUS_LABELS = { SUBMITTED: '제출 완료', OCR_PENDING: 'OCR 처리 중', OCR_DONE: 'OCR 완료', REVIEWING: '검토 중', APPROVED: '승인', REJECTED: '반려', SETTLED: '정산 완료' };
export const CATEGORIES = [
  { id: 1, name: '식비', description: '식사 및 음료', active: true },
  { id: 2, name: '교통비', description: '교통 및 이동', active: true },
  { id: 3, name: '인쇄비', description: '인쇄 및 제작', active: true },
  { id: 4, name: '소모품비', description: '운영 소모품', active: true },
  { id: 5, name: '기타', description: '기타 지출', active: true },
];
export const HISTORY_ACTION_LABELS = {
  SUBMITTED: '영수증 제출', OCR_RETRY_REQUESTED: 'OCR 재처리 요청', OCR_COMPLETED: 'OCR 처리 완료',
  OCR_UPDATED: 'OCR 결과 수정', APPROVED: '관리자 승인', REJECTED: '관리자 반려', SETTLED: '정산 완료',
};
export const RECEIPT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_RECEIPT_SIZE = 10 * 1024 * 1024;
export const REVIEWABLE = ['OCR_DONE', 'REVIEWING'];
export const money = (value) => value == null ? '인식 대기' : `${value.toLocaleString('ko-KR')}원`;
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
