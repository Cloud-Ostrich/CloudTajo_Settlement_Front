import { MOCK_ACCOUNTS } from './mockAccounts.js';
import { STATUS_LABELS } from './contracts.js';

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
}
// 기본 요청에도 이미지 참조를 제공해 업로드 요청과 같은 원본 조회 경로를 사용합니다.
function sampleImage(receipt) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="580" viewBox="0 0 480 580">
  <rect width="480" height="580" rx="12" fill="#fffcf6"/>
  <g font-family="sans-serif" text-anchor="middle" fill="#233349">
    <text x="240" y="62" font-size="12" fill="#078642">SAMPLE RECEIPT</text>
    <text x="240" y="120" font-size="24">${escapeXml(receipt.storeName)}</text>
    <text x="240" y="160" font-size="14" fill="#64748b">${escapeXml(receipt.paymentDate)}</text>
    <text x="240" y="250" font-size="15">${escapeXml(receipt.purpose.slice(0, 27))}</text>
    <path d="M40 400 H440" stroke="#cdd5dd" stroke-dasharray="5 5"/>
    <text x="65" y="450" font-size="18">합계</text>
    <text x="420" y="450" font-size="24" text-anchor="end">${receipt.amount.toLocaleString('ko-KR')}원</text>
    <text x="240" y="530" font-size="12" fill="#758195">Mock 기본 영수증 · 실제 원본이 아닙니다</text>
  </g></svg>`;
}

// 저장 데이터 호환 변환만 여기서 수행하며 API 응답에는 기존 필드를 노출하지 않습니다.
export function normalizeRequest(raw, index = 0) {
  const receiptId = Number.isSafeInteger(raw.receiptId) ? raw.receiptId : index + 101;
  const legacyOwner = { 'member-1': 1, 'member-2': 2, 'admin-1': 3 };
  const userId = legacyOwner[raw.userId || raw.requesterId] || Number(raw.userId) || 1;
  const user = MOCK_ACCOUNTS.find((account) => account.id === userId) || MOCK_ACCOUNTS[0];
  const paidAt = raw.paidAt ?? raw.paymentDate ?? null;
  const statusMap = { pending: 'OCR_DONE', approved: 'APPROVED', rejected: 'REJECTED', settled: 'SETTLED' };
  const status = statusMap[raw.status] || (STATUS_LABELS[raw.status] ? raw.status : 'OCR_DONE');
  const receipt = {
    receiptId, userId: user.id, userName: user.name,
    merchantName: raw.merchantName ?? raw.storeName ?? null, paidAt, amount: raw.amount ?? null,
    purpose: raw.purpose || '기존 정산 요청', categoryId: raw.categoryId || 5, memo: raw.memo || '',
    status, confidence: raw.confidence ?? (status === 'OCR_PENDING' ? null : 0.97),
    createdAt: raw.createdAt || '2026-10-05T10:00:00+09:00', rejectReason: raw.rejectReason || raw.rejectionReason || '',
    history: Array.isArray(raw.history) && raw.history.length ? raw.history : [{ label: '영수증 제출', at: '2026-10-05T10:00:00+09:00' }],
    fileName: raw.fileName || `${receiptId}.svg`, settledAt: raw.settledAt || null,
    image: raw.image || (raw.hasImage ? { storage: 'indexeddb', key: raw.id || raw.requestId } : null),
    ocrReadyAt: raw.ocrReadyAt || null,
  };
  if (!receipt.image) receipt.image = { storage: 'inline', svg: sampleImage({ storeName: receipt.merchantName || '샘플 영수증', paymentDate: receipt.paidAt || '2026-10-05', amount: receipt.amount || 0, purpose: receipt.purpose }) };
  return receipt;
}
export const DEFAULT_REQUESTS = [
  ['카페 그린브릿지', 1, 40000, '운영진 회의 음료', 'OCR_DONE', 1],
  ['프린트 스튜디오', 1, 28000, '행사 포스터 인쇄', 'APPROVED', 3],
  ['그린마트', 1, 36000, '행사 간식 구매', 'REJECTED', 1],
  ['모임공간', 1, 60000, '회의실 대관', 'SETTLED', 5],
  ['문구센터', 2, 22400, '행사 운영 물품', 'REVIEWING', 4],
].map(([merchantName, userId, amount, purpose, status, categoryId], index) => normalizeRequest({ receiptId: index + 101, merchantName, userId, amount, purpose, status, categoryId, paidAt: '2026-10-05', rejectReason: status === 'REJECTED' ? '참석자 명단을 보완해주세요.' : '' }, index));
