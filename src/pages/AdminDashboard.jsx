import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useMockData';
import { formatDashboardMetric, formatReviewMinutes, shiftMonth, today } from '../api/contracts';
import './Receipts.css';
import './Workspace.css';
import './Admin.css';
export default function AdminDashboard() {
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const currentMonth = today().slice(0, 7);
  const currentYear = Number(currentMonth.slice(0, 4));
  const [year, monthNumber] = month.split('-');
  const years = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index);
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  const monthLabel = `${year}년 ${Number(monthNumber)}월`;
  const { data: apiData, error, reload } = useApiData('/admin/dashboard/summary', { month });
  const categorySummaries = Array.isArray(apiData?.categorySummaries)
    ? apiData.categorySummaries
    : Array.isArray(apiData?.categoryStats) ? apiData.categoryStats : null;
  const data = apiData && {
    ...apiData,
    categoryStats: (categorySummaries || []).map((category) => ({ ...category, totalAmount: category.amount })),
  };
  return (
    <section className="workspace-page admin-dashboard">
      <div className="heading-row">
        <div className="page-heading"><span className="eyebrow">ADMIN OVERVIEW</span><h1>운영 대시보드</h1><p>{monthLabel} 정산 현황</p></div>
        <Link className="button primary" to="/admin/approvals">승인 관리 →</Link>
      </div>
      <div className="admin-month-controls" aria-label="월별 조회">
        <button type="button" className="admin-month-step" aria-label="이전 달" title="이전 달" onClick={() => setMonth((selectedMonth) => shiftMonth(selectedMonth, -1))}>◀</button>
        <div className="admin-month-selects">
          <select className="admin-month-dropdown admin-year-dropdown" aria-label="조회 연도" value={year} onChange={(event) => setMonth(`${event.target.value}-${monthNumber}`)}>
            {years.map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}년</option>)}
          </select>
          <select className="admin-month-dropdown admin-number-dropdown" aria-label="조회 월" value={monthNumber} onChange={(event) => setMonth(`${year}-${event.target.value}`)}>
            {months.map((optionMonth) => <option key={optionMonth} value={optionMonth}>{Number(optionMonth)}월</option>)}
          </select>
        </div>
        <button type="button" className="admin-month-step" aria-label="다음 달" title="다음 달" onClick={() => setMonth((selectedMonth) => shiftMonth(selectedMonth, 1))}>▶</button>
        <button type="button" className="button secondary admin-current-month" disabled={month === currentMonth} onClick={() => setMonth(currentMonth)}>이번 달</button>
      </div>
      {error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={reload}>다시 시도</button></p>}
      {!data && !error && <p role="status">운영 현황 불러오는 중…</p>}
      {data && <>
        <div className="summary-grid">{[['총 승인·정산 금액', formatDashboardMetric(data.totalAmount, '원')], ['정산 대기 금액', formatDashboardMetric(data.approvedAmount, '원')], ['처리 대기', formatDashboardMetric(data.pendingCount, '건')], ['반려', formatDashboardMetric(data.rejectedCount, '건')], ['정산 완료', formatDashboardMetric(data.settledCount, '건')], ['평균 검토 시간', data.averageReviewMinutes === null ? '집계값 없음' : formatReviewMinutes(data.averageReviewMinutes)]].map(([label, value]) => <div className="receipt-card summary-card" key={label}><span className="muted">{label}</span><strong className="summary-value">{value}</strong></div>)}</div>
        <section className="receipt-card"><h2>카테고리별 제출 현황</h2><div className="table-scroll"><table className="request-table"><thead><tr><th>카테고리</th><th>건수</th><th>금액</th></tr></thead><tbody>{data.categoryStats.map((category) => <tr key={category.categoryId}><td>{category.categoryName}</td><td>{formatDashboardMetric(category.count, '건')}</td><td>{formatDashboardMetric(category.totalAmount, '원')}</td></tr>)}</tbody></table></div>{!data.categoryStats.length && <p className="muted" role="status">{categorySummaries === null ? '카테고리 집계 정보가 제공되지 않았습니다.' : '해당 월의 카테고리 집계가 없습니다.'}</p>}</section>
      </>}
    </section>
  );
}
