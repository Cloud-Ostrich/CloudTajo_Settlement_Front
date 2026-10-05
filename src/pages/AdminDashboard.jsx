import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useMockData';
import { money } from '../api/contracts';
import './Receipts.css';
import './Workspace.css';
import './Admin.css';
export default function AdminDashboard() {
  const { data, error, reload } = useApiData('/admin/dashboard/summary');
  return <section className="workspace-page admin-dashboard"><div className="heading-row"><div className="page-heading"><span className="eyebrow">ADMIN OVERVIEW</span><h1>운영 대시보드</h1><p>{data?.month || '이번 달'} 정산 현황을 확인하세요.</p></div><Link className="button primary" to="/admin/approvals">승인 관리 →</Link></div>{error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={reload}>다시 시도</button></p>}{!data && !error && <p role="status">운영 현황 불러오는 중…</p>}{data && <><div className="summary-grid">{[['총 제출 금액', money(data.totalAmount)], ['승인 금액', money(data.approvedAmount)], ['처리 대기', `${data.pendingCount}건`], ['반려', `${data.rejectedCount}건`], ['정산 완료', `${data.settledCount}건`], ['평균 검토 시간', `${data.avgReviewMinutes}분`]].map(([label, value]) => <div className="receipt-card summary-card" key={label}><span className="muted">{label}</span><strong className="summary-value">{value}</strong></div>)}</div><section className="receipt-card"><h2>카테고리별 제출 현황</h2><div className="table-scroll"><table className="request-table"><thead><tr><th>카테고리</th><th>건수</th><th>금액</th></tr></thead><tbody>{data.categoryStats.map((c) => <tr key={c.categoryId}><td>{c.categoryName}</td><td>{c.count}건</td><td>{money(c.totalAmount)}</td></tr>)}</tbody></table></div></section></>}</section>;
}
