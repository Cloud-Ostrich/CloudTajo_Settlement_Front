import { money } from '../api/contracts';

function confirmedValue(value) {
  if (value == null || value === '') return '미확정';
  return value;
}

export default function FinalOcrDetails({ receipt }) {
  return <section className="final-ocr-details" aria-label="최종 확정 정보">
    <h3 className="section-title">최종 확정 정보</h3>
    <dl className="detail-fields">
      <div><dt>사용처</dt><dd>{confirmedValue(receipt.merchantName)}</dd></div>
      <div><dt>결제일</dt><dd>{confirmedValue(receipt.paidAt)}</dd></div>
      <div><dt>총 금액</dt><dd>{receipt.amount == null ? '미확정' : money(receipt.amount)}</dd></div>
    </dl>
  </section>;
}