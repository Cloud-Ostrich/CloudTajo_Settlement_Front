import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryNameFor, historyActionLabel, STATUS_LABELS, money, receiptIdOf, SUBMISSION_SUMMARIES, matchesSubmissionFilter } from '../api/contracts';
import { useApiData } from '../hooks/useMockData';
import StatusBadge from '../components/StatusBadge';
import UserReceiptImage from '../components/UserReceiptImage';
import './Receipts.css';
import './Workspace.css';
import './Dashboard.css';
import './ReceiptDetail.css';
function ReceiptDetail({ id, onClose }) {
  const { data: response, error, reload } = useApiData(`/receipts/${id}`);
  const receipt = response && { ...response, receiptId: receiptIdOf(response) };
  const { data: categories } = useApiData(receipt && !receipt.categoryName ? '/categories' : null);
  const categoryName = categoryNameFor(receipt, categories);
  const { data: histories } = useApiData(`/receipts/${id}/histories`);
  const timeline = histories || [];
  const rejection = [...timeline].reverse().find((item) => item.action === 'REJECTED');
  const settlement = [...timeline].reverse().find((item) => item.action === 'SETTLED');
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  const processing = receipt && ['SUBMITTED', 'OCR_PENDING'].includes(receipt.status);
  const hasOcr = receipt && !processing && [receipt.merchantName, receipt.paidAt, receipt.amount, receipt.ocrResult?.confidence].some((value) => value != null);
  function handleDialogClick(event) {
    if (event.target !== event.currentTarget) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) onClose();
  }
  return <dialog ref={dialogRef} className="receipt-detail-dialog" aria-labelledby="receipt-detail-title" onCancel={onClose} onClick={handleDialogClick}>
    <div className="card-heading receipt-detail-dialog-header"><h2 id="receipt-detail-title">영수증 상세</h2><button type="button" className="modal-close" onClick={onClose} aria-label="영수증 상세 닫기"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div>
    <div className="receipt-detail-dialog-body">
    {error ? <p className="error-message" role="alert">{error} <button className="text-button" onClick={reload}>다시 시도</button></p> : !receipt ? <p role="status">상세 정보를 불러오는 중…</p> : <>
      <div className="review-grid">
        <div><h3 className="section-title">원본 영수증</h3><UserReceiptImage receipt={receipt} /></div>
        <div className="receipt-detail-info"><StatusBadge status={receipt.status} /><h3 className="section-title">제출 정보</h3><dl className="detail-fields">
          <div><dt>제출 번호</dt><dd>#{receipt.receiptId}</dd></div>
          {receipt.submitter?.name && <div><dt>제출자</dt><dd>{receipt.submitter.name}</dd></div>}
          <div><dt>사용 목적</dt><dd>{receipt.purpose}</dd></div>
          <div><dt>카테고리</dt><dd>{categoryName}</dd></div>
          {receipt.memo && <div><dt>메모</dt><dd>{receipt.memo}</dd></div>}
        </dl>
        {processing ? <p className="receipt-tip" role="status">{receipt.status === 'OCR_PENDING' ? 'OCR 처리 중입니다.' : '영수증이 제출되었습니다. OCR 처리를 기다리고 있습니다.'}</p> : hasOcr ? <><h3 className="section-title">OCR 결과</h3><dl className="detail-fields"><div><dt>사용처</dt><dd>{receipt.merchantName ?? '인식 결과 없음'}</dd></div><div><dt>결제일</dt><dd>{receipt.paidAt ?? '인식 결과 없음'}</dd></div><div><dt>총 금액</dt><dd>{receipt.amount == null ? '인식 결과 없음' : money(receipt.amount)}</dd></div><div><dt>인식 신뢰도</dt><dd>{receipt.ocrResult?.confidence == null ? '인식 결과 없음' : `${Math.round(receipt.ocrResult.confidence * 100)}%`}</dd></div></dl></> : <p className="receipt-tip">OCR 결과가 없습니다.</p>}
        {receipt.status === 'REJECTED' && <div className="rejection-note"><strong>반려 사유</strong><p>{rejection?.reason || '등록된 반려 사유가 없습니다.'}</p></div>}
        {settlement?.snapshot?.settledAt && <p className="muted">정산일 · {settlement.snapshot.settledAt}</p>}
        </div>
      </div>
      {!!timeline.length && <><h3 className="section-title">처리 이력</h3><ol className="receipt-timeline">{timeline.map((item) => <li key={item.id}><div className="timeline-content"><strong>{historyActionLabel(item.action)}</strong>{(item.reason || item.snapshot?.comment) && <p>{item.reason || item.snapshot.comment}</p>}</div><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</time></li>)}</ol></>}
    </>}
    </div>
  </dialog>;
}
function Dashboard() {
  const { data, error, reload } = useApiData('/receipts/my');
  const receipts = (data?.items || []).map((item) => ({ ...item, receiptId: receiptIdOf(item) }));
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const visible = receipts.filter((r) => matchesSubmissionFilter(r, filter));
  return <section className="workspace-page user-dashboard">
    <div className="heading-row"><div className="page-heading"><h1>내 제출 현황</h1><p>영수증 제출부터 정산까지 한눈에 확인하세요.</p></div><Link className="button primary" to="/receipts/new">+ 영수증 등록</Link></div>
    <div className="dashboard-summaries">{SUBMISSION_SUMMARIES.map((summary) => <button key={summary.key} className={`dashboard-summary ${filter === summary.key ? 'selected' : ''}`} onClick={() => setFilter(filter === summary.key ? 'all' : summary.key)} aria-pressed={filter === summary.key}><span><i className={`summary-dot dot-${summary.key}`} aria-hidden="true" />{summary.label}</span><strong>{receipts.filter((r) => summary.statuses.includes(r.status)).length}<small>건</small></strong></button>)}</div>
    <section className="dashboard-list"><div className="dashboard-list-heading"><h2>제출 내역 <span className="count-label">{visible.length}건</span></h2><div className="filter-tabs" aria-label="제출 상태 필터">{[{ key: 'all', label: '전체' }, ...SUBMISSION_SUMMARIES].map(({ key, label }) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
      {error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={reload}>다시 시도</button></p>}
      {!data && !error ? <p className="list-empty" role="status">제출 내역 불러오는 중…</p> : <ul className="submission-cards" aria-label="제출 내역">{visible.map((r) => <li key={r.receiptId}><button className="submission-card" onClick={() => setSelectedId(r.receiptId)} aria-haspopup="dialog" aria-expanded={selectedId === r.receiptId}>
        <span className="submission-main"><strong>{r.merchantName || '영수증 처리 중'}</strong><span className="submission-purpose">{r.purpose}<span className="submission-category"> · {r.categoryName}</span></span><span className="submission-date">{r.paidAt ? r.paidAt.replaceAll('-', '.') : '결제일 확인 중'}</span></span>
        <span className="submission-side"><span className={`status-badge status-${r.status}`}>{r.status === 'REVIEWING' ? '관리자 검토 중' : STATUS_LABELS[r.status]}</span><strong className="submission-amount">{money(r.amount)}</strong></span><span className="submission-chevron" aria-hidden="true">›</span>
      </button></li>)}</ul>}
      {data && !visible.length && <p className="list-empty">해당 상태의 제출 내역이 없습니다.</p>}
    </section>
    {selectedId && <ReceiptDetail key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />}
  </section>;
}
export default Dashboard;
