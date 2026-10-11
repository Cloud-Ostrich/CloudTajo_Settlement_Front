import { progressSteps } from '../api/receiptUX';
import './ReceiptUX.css';
export default function ReceiptProgress({ status, histories }) {
  return <section aria-label="영수증 처리 단계"><h3 className="section-title">처리 진행 상황</h3><ol className="receipt-progress">{progressSteps(status, histories).map((step) => <li key={step.label} className={`${step.complete ? 'complete' : ''} ${step.current ? 'current' : ''} ${step.rejected ? 'rejected' : ''}`} aria-current={step.current ? 'step' : undefined}>{step.complete ? '✓ ' : ''}{step.label}</li>)}</ol>{!['SUBMITTED', 'OCR_PENDING', 'OCR_DONE', 'REVIEWING', 'APPROVED', 'REJECTED', 'SETTLED'].includes(status) && <p className="muted">처리 상태를 확인할 수 없습니다.</p>}</section>;
}
