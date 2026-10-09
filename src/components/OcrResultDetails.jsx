import { money } from '../api/contracts';

const completedWorkflowStatuses = new Set(['OCR_DONE', 'REVIEWING', 'APPROVED', 'REJECTED', 'SETTLED']);

function displayValue(value, isAmount = false) {
  if (value == null || (typeof value === 'string' && !value.trim())) return '인식된 정보 없음';
  return isAmount && typeof value === 'number' ? money(value) : value;
}

export default function OcrResultDetails({ ocrResult, workflowStatus, waitingMessage = 'OCR 결과가 없습니다.' }) {
  const isComplete = ocrResult?.status != null
    ? ocrResult.status === 'OCR_DONE'
    : completedWorkflowStatuses.has(workflowStatus);
  const rawValues = [ocrResult?.merchantNameRaw, ocrResult?.paidAtRaw, ocrResult?.amountRaw];
  const hasRawValues = rawValues.some((value) => value != null && (typeof value !== 'string' || value.trim()));

  return <section className="ocr-result-details" aria-label="OCR 인식 정보">
    <p className="muted" role="status">{isComplete ? 'OCR 인식 완료' : 'OCR 인식 대기'}</p>
    {!isComplete ? <p className="receipt-tip">{waitingMessage}</p> : !hasRawValues ? <p className="receipt-tip">인식된 정보 없음</p> : <>
      <h3 className="section-title">OCR 인식 결과(관리자 검토 전)</h3>
      <dl className="detail-fields">
        <div><dt>OCR 원본 상호명</dt><dd>{displayValue(ocrResult?.merchantNameRaw)}</dd></div>
        <div><dt>OCR 원본 결제일</dt><dd>{displayValue(ocrResult?.paidAtRaw)}</dd></div>
        <div><dt>OCR 원본 금액</dt><dd>{displayValue(ocrResult?.amountRaw, true)}</dd></div>
        {ocrResult?.confidence != null && <div><dt>인식 신뢰도</dt><dd>{`${Math.round(ocrResult.confidence * 100)}%`}</dd></div>}
      </dl>
    </>}
  </section>;
}