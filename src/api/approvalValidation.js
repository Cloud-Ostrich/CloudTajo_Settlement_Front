// 관리자 확정 필드만 검증합니다. OCR 원본값은 승인 요건을 충족하지 않습니다.
export function missingApprovalFields(receipt) {
  return [['merchantName', '상호명'], ['paidAt', '결제일'], ['amount', '금액']]
    .filter(([field]) => receipt?.[field] == null || (typeof receipt[field] === 'string' && !receipt[field].trim()))
    .map(([, label]) => label);
}
