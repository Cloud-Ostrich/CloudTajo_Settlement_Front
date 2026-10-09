import { Link } from 'react-router-dom';
import { receiptIdOf } from '../api/contracts';

export default function ResubmitReceiptLink({ receipt }) {
  if (receipt.status !== 'REJECTED') return null;
  return <Link className="button secondary" to="/receipts/new" state={{ resubmission: {
    sourceId: receiptIdOf(receipt),
    purpose: receipt.purpose,
    categoryId: receipt.categoryId,
    memo: receipt.memo,
  } }}>다시 제출</Link>;
}
