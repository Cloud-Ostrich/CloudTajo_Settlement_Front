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
  const fields = ['merchantName', 'paidAt', 'amount'];
  const rawFields = ['merchantNameRaw', 'paidAtRaw', 'amountRaw'];
  const unconfirmed = finalValues ? fields.map(field => finalValues[field] == null || typeof finalValues[field] === 'string' && !finalValues[field].trim()) : [];
  const displayValues = finalValues
    ? fields.map((field, index) => unconfirmed[index] ? ocrResult?.[rawFields[index]] : finalValues[field])
    : [ocrResult?.merchantNameRaw, ocrResult?.paidAtRaw, ocrResult?.amountRaw];
  const hasDisplayValues = displayValues.some((value) => value != null && (typeof value !== 'string' || value.trim()));
  const displayHeading = finalValues ? '영수증 정보 (확정값·OCR 원본)' : 'OCR 인식 결과(관리자 검토 전)';

  return <section className="ocr-result-details" aria-label={finalValues ? '최종 확정 정보' : 'OCR 인식 정보'}>
    <p className="muted" role="status">{isComplete ? 'OCR 인식 완료' : 'OCR 인식 대기'}</p>
    {!isComplete ? <p className="receipt-tip">{waitingMessage}</p> : !hasDisplayValues ? <p className="receipt-tip">{'인식 결과 없음'}</p> : <>
      <h3 className="section-title">{displayHeading}</h3>{finalValues && <p className="muted">저장된 확정값을 우선 표시합니다. 미확정 항목은 OCR 원본이며, 저장된 확정값과 구분됩니다.</p>}
      <dl className="detail-fields">
        <div><dt>{finalValues ? '상호명' : 'OCR 원본 상호명'}</dt><dd><span>{displayValue(displayValues[0])}</span>{finalValues && <small className="muted" style={{ display: 'block' }}>{unconfirmed[0] ? (displayValues[0] == null || displayValues[0] === '' ? '확정값 미저장 · OCR 원본 없음' : 'OCR 원본 · 확정값 미저장') : '저장된 확정값'}</small>}</dd></div>
        <div><dt>{finalValues ? '결제일' : 'OCR 원본 결제일'}</dt><dd><span>{displayValue(displayValues[1])}</span>{finalValues && <small className="muted" style={{ display: 'block' }}>{unconfirmed[1] ? (displayValues[1] == null || displayValues[1] === '' ? '확정값 미저장 · OCR 원본 없음' : 'OCR 원본 · 확정값 미저장') : '저장된 확정값'}</small>}</dd></div>
        <div><dt>{finalValues ? '총 금액' : 'OCR 원본 금액'}</dt><dd><span>{displayValue(displayValues[2], true)}</span>{finalValues && <small className="muted" style={{ display: 'block' }}>{unconfirmed[2] ? (displayValues[2] == null || displayValues[2] === '' ? '확정값 미저장 · OCR 원본 없음' : 'OCR 원본 · 확정값 미저장') : '저장된 확정값'}</small>}</dd></div>
        <div><dt>인식 신뢰도</dt><dd>{ocrResult?.confidence == null ? '신뢰도 정보 없음' : `${Math.round(ocrResult.confidence * 100)}%`}</dd></div>
      </dl>
    </>}
    {isComplete && !hasDisplayValues && <p className="muted">신뢰도 · {ocrResult?.confidence == null ? '신뢰도 정보 없음' : `${Math.round(ocrResult.confidence * 100)}%`}</p>}
  </section>;
}