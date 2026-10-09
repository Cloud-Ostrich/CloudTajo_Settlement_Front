import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useApiData } from '../hooks/useMockData';
import { money, receiptIdOf, shiftMonth, today } from '../api/contracts';
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
  const { data: receiptData } = useApiData('/admin/receipts');
  const [avgReviewMinutes, setAvgReviewMinutes] = useState(0);
  useEffect(() => {
    if (!apiData?.month || !receiptData?.items) return;
    let active = true;
    const reviewed = receiptData.items.filter((receipt) => ['APPROVED', 'REJECTED', 'SETTLED'].includes(receipt.status) && receipt.paidAt?.startsWith(apiData.month));
    Promise.all(reviewed.map(async (receipt) => {
      const response = await apiRequest({ method: 'GET', url: `/receipts/${receiptIdOf(receipt)}/histories` });
      const submittedAt = response.data.find((item) => item.action === 'SUBMITTED')?.createdAt;
      const decisionAt = response.data.find((item) => ['APPROVED', 'REJECTED'].includes(item.action))?.createdAt;
      return submittedAt && decisionAt ? Math.max(0, (Date.parse(decisionAt) - Date.parse(submittedAt)) / 60000) : null;
    })).then((durations) => {
      if (!active) return;
      const validDurations = durations.filter((duration) => duration != null);
      setAvgReviewMinutes(validDurations.length ? Math.round(validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length) : 0);
    }).catch(() => {
      if (active) setAvgReviewMinutes(0);
    });
    return () => { active = false; };
  }, [apiData?.month, receiptData]);
  const categorySummaries = Array.isArray(apiData?.categorySummaries)
    ? apiData.categorySummaries
    : Array.isArray(apiData?.categoryStats) ? apiData.categoryStats : [];
  const data = apiData && {
    ...apiData,
    avgReviewMinutes: apiData.averageReviewMinutes ?? avgReviewMinutes,
    categoryStats: categorySummaries.map((category) => ({ ...category, totalAmount: category.amount })),
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
        <div className="summary-grid">{[['총 제출 금액', money(data.totalAmount)], ['승인 금액', data.approvedAmount == null ? '집계 정보 없음' : money(data.approvedAmount)], ['처리 대기', `${data.pendingCount}건`], ['반려', `${data.rejectedCount}건`], ['정산 완료', data.settledCount == null ? '집계 정보 없음' : `${data.settledCount}건`], ['평균 검토 시간', `${data.avgReviewMinutes}분`]].map(([label, value]) => <div className="receipt-card summary-card" key={label}><span className="muted">{label}</span><strong className="summary-value">{value}</strong></div>)}</div>
        <section className="receipt-card"><h2>카테고리별 제출 현황</h2><div className="table-scroll"><table className="request-table"><thead><tr><th>카테고리</th><th>건수</th><th>금액</th></tr></thead><tbody>{data.categoryStats.map((category) => <tr key={category.categoryId}><td>{category.categoryName}</td><td>{category.count}건</td><td>{money(category.totalAmount)}</td></tr>)}</tbody></table></div></section>
      </>}
    </section>
  );
}
