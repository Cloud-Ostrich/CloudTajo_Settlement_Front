import { STATUS_LABELS } from '../api/contracts';
export default function StatusBadge({ status }) { return <span className={`status-badge status-${status}`}>{status === 'REVIEWING' ? '관리자 검토 중' : STATUS_LABELS[status]}</span>; }
