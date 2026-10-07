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
function legacyAction(item) {
  if (item.action) return item.action;
  const label = item.label || '';
  if (label.includes('반려')) return 'REJECTED';
  if (label.includes('승인')) return 'APPROVED';
  if (label.includes('정산')) return 'SETTLED';
  if (label.includes('OCR 결과 수정')) return 'OCR_UPDATED';
  if (label.includes('OCR 완료')) return 'OCR_COMPLETED';
  if (label.includes('OCR 처리') && !label.includes('제출')) return 'OCR_RETRY_REQUESTED';
  if (label.includes('검토')) return 'OCR_UPDATED';
  return 'SUBMITTED';
}
export function normalizeRequest(raw, index = 0) {
  const receiptId = Number.isSafeInteger(raw.receiptId) ? raw.receiptId : index + 101;
  const legacyOwner = { 'member-1': 1, 'member-2': 2, 'admin-1': 3 };
  const userId = legacyOwner[raw.userId || raw.requesterId] || Number(raw.userId ?? raw.submitterId ?? raw.submitter?.id) || 1;
  const user = MOCK_ACCOUNTS.find((account) => account.id === userId) || MOCK_ACCOUNTS[0];
  const paidAt = raw.paidAt ?? raw.paymentDate ?? raw.ocrResult?.paidAtRaw ?? null;
  const statusMap = { pending: 'OCR_DONE', approved: 'APPROVED', rejected: 'REJECTED', settled: 'SETTLED' };
  const status = statusMap[raw.status] || (STATUS_LABELS[raw.status] ? raw.status : 'OCR_DONE');
  const createdAt = raw.createdAt || '2026-10-05T10:00:00+09:00';
  const fileName = raw.fileName || raw.file?.originalFilename || `${receiptId}.svg`;
  const storedHistory = Array.isArray(raw.history) && raw.history.length ? raw.history : null;
  const history = (storedHistory || [{ action: 'SUBMITTED', createdAt, fromStatus: null, toStatus: status === 'SUBMITTED' ? 'SUBMITTED' : 'OCR_PENDING' }]).map((item, historyIndex) => {
      const action = legacyAction(item);
      return {
        id: item.id ?? `${receiptId}-${historyIndex + 1}`, receiptId,
        actorId: item.actorId ?? (action === 'SUBMITTED' ? user.id : 3), action,
        fromStatus: item.fromStatus ?? null,
        toStatus: item.toStatus ?? (action === 'SUBMITTED' ? status : null),
        reason: item.reason ?? '',
        snapshot: item.snapshot ?? (item.comment ? { comment: item.comment } : {}),
        createdAt: item.createdAt ?? item.at ?? createdAt,
      };
    });
  if (!storedHistory) {
    const events = {
      OCR_PENDING: [],
      SUBMITTED: [],
      OCR_DONE: [],
      REVIEWING: [['OCR_UPDATED', 'OCR_DONE', 'REVIEWING']],
      APPROVED: [['APPROVED', 'OCR_DONE', 'APPROVED']],
      REJECTED: [['REJECTED', 'OCR_DONE', 'REJECTED']],
      SETTLED: [['APPROVED', 'OCR_DONE', 'APPROVED'], ['SETTLED', 'APPROVED', 'SETTLED']],
    }[status] || [];
    events.forEach(([action, fromStatus, toStatus], eventIndex) => {
      const eventTime = new Date(Date.parse(createdAt) + (eventIndex + 1) * 60000).toISOString();
      history.push({
        id: `${receiptId}-${history.length + 1}`, receiptId, actorId: 3,
        action, fromStatus, toStatus,
        reason: action === 'REJECTED' ? raw.rejectReason || raw.rejectionReason || '' : '',
        snapshot: action === 'SETTLED' ? { settledAt: raw.settledAt || raw.settlement?.settledAt, comment: raw.settlementComment || raw.settlement?.comment || '' } : {},
        createdAt: eventTime,
      });
    });
  }
  const legacyRejectionReason = raw.rejectReason || raw.rejectionReason || '';
  if (status === 'REJECTED' && legacyRejectionReason && !history.some((item) => item.action === 'REJECTED')) {
    const createdAt = new Date(Date.parse(history.at(-1)?.createdAt || raw.createdAt || '2026-10-05T10:00:00+09:00') + 60000).toISOString();
    history.push({ id: `${receiptId}-${history.length + 1}`, receiptId, actorId: 3, action: 'REJECTED', fromStatus: 'REVIEWING', toStatus: 'REJECTED', reason: legacyRejectionReason, snapshot: {}, createdAt });
  }
  const legacySettledAt = raw.settledAt || raw.settlement?.settledAt;
  if (status === 'SETTLED' && legacySettledAt && !history.some((item) => item.action === 'SETTLED')) {
    const createdAt = new Date(Date.parse(history.at(-1)?.createdAt || raw.createdAt || '2026-10-05T10:00:00+09:00') + 60000).toISOString();
    history.push({ id: `${receiptId}-${history.length + 1}`, receiptId, actorId: raw.settledBy || raw.settlement?.settledBy || 3, action: 'SETTLED', fromStatus: 'APPROVED', toStatus: 'SETTLED', reason: '', snapshot: { settledAt: legacySettledAt, comment: raw.settlementComment || raw.settlement?.comment || '' }, createdAt });
  }
  const receipt = {
    receiptId, userId: user.id, userName: user.name,
    merchantName: raw.merchantName ?? raw.storeName ?? raw.ocrResult?.merchantNameRaw ?? null, paidAt, amount: raw.amount ?? raw.ocrResult?.amountRaw ?? null,
    purpose: raw.purpose || '기존 정산 요청', categoryId: raw.categoryId || 5, memo: raw.memo || '',
    status, confidence: raw.confidence ?? raw.ocrResult?.confidence ?? (['OCR_DONE', 'REVIEWING', 'APPROVED', 'REJECTED', 'SETTLED'].includes(status) ? 0.97 : null),
    createdAt, rejectReason: raw.rejectReason || raw.rejectionReason || '',
    history,
    imageUrl: raw.imageUrl ?? null,
    fileName,
    contentType: raw.contentType || raw.file?.contentType || (fileName.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg'),
    fileSize: Number.isSafeInteger(raw.fileSize ?? raw.file?.fileSize) ? (raw.fileSize ?? raw.file.fileSize) : 0,
    settledAt: raw.settledAt || raw.settlement?.settledAt || null,
    settledBy: raw.settledBy || raw.settlement?.settledBy || 3,
    settlementComment: raw.settlementComment || raw.settlement?.comment || '',
    image: raw.image || (raw.hasImage ? { storage: 'indexeddb', key: raw.id || raw.requestId } : null),
    ocrReadyAt: raw.ocrReadyAt || null,
  };
  if (!receipt.image && !receipt.imageUrl) receipt.image = { storage: 'inline', svg: sampleImage({ storeName: receipt.merchantName || '샘플 영수증', paymentDate: receipt.paidAt || '2026-10-05', amount: receipt.amount || 0, purpose: receipt.purpose }) };
  return receipt;
}
export const DEFAULT_REQUESTS = [
  ['카페 그린브릿지', 1, 40000, '운영진 회의 음료', 'OCR_DONE', 1],
  ['프린트 스튜디오', 1, 28000, '행사 포스터 인쇄', 'APPROVED', 3],
  ['그린마트', 1, 36000, '행사 간식 구매', 'REJECTED', 1],
  ['모임공간', 1, 60000, '회의실 대관', 'SETTLED', 5],
  ['문구센터', 2, 22400, '행사 운영 물품', 'REVIEWING', 4],
].map(([merchantName, userId, amount, purpose, status, categoryId], index) => normalizeRequest({ receiptId: index + 101, merchantName, userId, amount, purpose, status, categoryId, paidAt: '2026-10-05', rejectReason: status === 'REJECTED' ? '참석자 명단을 보완해주세요.' : '' }, index));
