import { money } from '../api/contracts';

const completedWorkflowStatuses = new Set(['OCR_DONE', 'REVIEWING', 'APPROVED', 'REJECTED', 'SETTLED']);

function displayValue(value, isAmount = false) {
  if (value == null || (typeof value === 'string' && !value.trim())) return '인식된 정보 없음';
  return isAmount && typeof value === 'number' ? money(value) : value;
}

export default function OcrResultDetails({ ocrResult, workflowStatus, waitingMessage = 'OCR 결과가 없습니다.', finalValues }) {
  const isComplete = ocrResult?.status != null
    ? ocrResult.status === 'OCR_DONE'
    : completedWorkflowStatuses.has(workflowStatus);
  const displayValues = finalValues
    ? [finalValues.merchantName ?? ocrResult?.merchantNameRaw, finalValues.paidAt ?? ocrResult?.paidAtRaw, finalValues.amount ?? ocrResult?.amountRaw]
    : [ocrResult?.merchantNameRaw, ocrResult?.paidAtRaw, ocrResult?.amountRaw];
  const hasDisplayValues = displayValues.some((value) => value != null && (typeof value !== 'string' || value.trim()));
  const displayHeading = finalValues ? 'OCR 결과' : 'OCR 인식 결과(관리자 검토 전)';

  return <section className="ocr-result-details" aria-label={finalValues ? '최종 확정 정보' : 'OCR 인식 정보'}>
    <p className="muted" role="status">{isComplete ? 'OCR 인식 완료' : 'OCR 인식 대기'}</p>
    {!isComplete ? <p className="receipt-tip">{waitingMessage}</p> : !hasDisplayValues ? <p className="receipt-tip">{finalValues ? '인식 정보 없음' : '인식된 정보 없음'}</p> : <>
      <h3 className="section-title">{displayHeading}</h3>
      <dl className="detail-fields">
        <div><dt>{finalValues ? '상호명' : 'OCR 원본 상호명'}</dt><dd>{displayValue(displayValues[0])}</dd></div>
        <div><dt>{finalValues ? '결제일' : 'OCR 원본 결제일'}</dt><dd>{displayValue(displayValues[1])}</dd></div>
        <div><dt>{finalValues ? '총 금액' : 'OCR 원본 금액'}</dt><dd>{displayValue(displayValues[2], true)}</dd></div>
        <div><dt>인식 신뢰도</dt><dd>{ocrResult?.confidence == null ? '신뢰도 정보 없음' : `${Math.round(ocrResult.confidence * 100)}%`}</dd></div>
      </dl>
    </>}
    {isComplete && !hasDisplayValues && <p className="muted">신뢰도 · {ocrResult?.confidence == null ? '신뢰도 정보 없음' : `${Math.round(ocrResult.confidence * 100)}%`}</p>}
  </section>;
}