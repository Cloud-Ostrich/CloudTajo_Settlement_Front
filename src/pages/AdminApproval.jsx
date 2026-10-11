import { useEffect, useMemo, useRef, useState } from 'react';
import { approveReceipt, rejectReceipt, settleReceipt, updateOcr } from '../api/endpoints';
import { categoryNameFor, submitterLabel, historyActionLabel, receiptIdOf, REVIEWABLE, money, today } from '../api/contracts';
import { useApiData } from '../hooks/useMockData';
import { receiptPreviewValues, useAdminReceiptPreviews } from '../hooks/useAdminReceiptPreviews';
import { historyTimeLabel, searchSortReceipts } from '../api/receiptUX';
import ConfirmAction from '../components/ConfirmAction';
import StatusBadge from '../components/StatusBadge';
import UserReceiptImage from '../components/UserReceiptImage';
import OcrResultDetails from '../components/OcrResultDetails';
import './Receipts.css';
import './Workspace.css';
import './ReceiptDetail.css';
import './Admin.css';
function DetailActions({ receipt, onRefresh }) {
  const [values, setValues] = useState({ merchantName: receipt.merchantName ?? receipt.ocrResult?.merchantNameRaw ?? '', paidAt: receipt.paidAt ?? receipt.ocrResult?.paidAtRaw ?? '', amount: receipt.amount ?? receipt.ocrResult?.amountRaw ?? '', reason: '' });
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [comment, setComment] = useState('');
  const [settledAt, setSettledAt] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const pending = useRef(false);
  async function run(operation, message) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await operation(); setEditing(false); setRejecting(false); setNotice(message); onRefresh(); }
    catch (err) { setError(err.message); }
    finally { pending.current = false; setBusy(false); setConfirmation(null); }
  }
  const reviewable = REVIEWABLE.includes(receipt.status);
  function edit() { setValues({ merchantName: receipt.merchantName ?? receipt.ocrResult?.merchantNameRaw ?? '', paidAt: receipt.paidAt ?? receipt.ocrResult?.paidAtRaw ?? '', amount: receipt.amount ?? receipt.ocrResult?.amountRaw ?? '', reason: '' }); setEditing(true); setRejecting(false); }
  return <><div className="card-heading section-title"><h3>OCR 결과</h3>{reviewable && <button className="text-button" disabled={busy} onClick={edit}>OCR 수정</button>}</div><dl className="detail-fields"><div><dt>사용처</dt><dd>{receipt.merchantName || '인식 대기'}</dd></div><div><dt>결제일</dt><dd>{receipt.paidAt || '인식 대기'}</dd></div><div><dt>총 금액</dt><dd className="detail-amount">{money(receipt.amount)}</dd></div><div><dt>인식 신뢰도</dt><dd>{receipt.confidence == null ? '인식 대기' : `${Math.round(receipt.confidence * 100)}%`}</dd></div></dl>{editing && <form className="review-form reject-form" onSubmit={(e) => { e.preventDefault(); run(() => updateOcr(receipt.receiptId, { ...values, amount: Number(values.amount) }), 'OCR 결과를 수정했습니다.'); }}><fieldset disabled={busy}>{[['merchantName', '사용처', 'text'], ['paidAt', '결제일', 'date'], ['amount', '총 금액 (원)', 'text']].map(([name, label, type]) => <label key={name}>{label}<input type={type} value={values[name]} inputMode={name === 'amount' ? 'numeric' : undefined} pattern={name === 'amount' ? '[0-9]+' : undefined} required onChange={(e) => setValues({ ...values, [name]: e.target.value })} /></label>)}<label>수정 사유 (필수)<textarea value={values.reason} required maxLength={500} onChange={(e) => setValues({ ...values, reason: e.target.value })} rows={3} /></label></fieldset><div className="decision-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setEditing(false)}>취소</button><button className="button primary" disabled={busy}>OCR 수정 저장</button></div></form>}{reviewable && !editing && <div className="review-form"><label className="section-title">검토 의견 (선택)<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} disabled={busy} /></label><div className="decision-actions"><button className="button danger" disabled={busy} onClick={() => setRejecting(true)}>반려</button><button className="button primary" disabled={busy || rejecting} onClick={() => setConfirmation({ message: '이 영수증을 승인하시겠습니까?', operation: () => approveReceipt(receipt.receiptId, { comment }), success: '요청을 승인했습니다.' })}>승인</button></div></div>}{rejecting && reviewable && <form className="review-form reject-form" onSubmit={(e) => { e.preventDefault(); if (rejectReason.trim()) setConfirmation({ message: '이 영수증을 반려하시겠습니까?', operation: () => rejectReceipt(receipt.receiptId, { rejectReason }), success: '사유와 함께 반려했습니다.' }); }}><label>반려 사유 (필수)<textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} required maxLength={500} rows={3} disabled={busy} placeholder="영수증 이미지가 흐려 금액 확인이 어렵습니다." /></label><div className="decision-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setRejecting(false)}>취소</button><button className="button danger" disabled={busy || !rejectReason.trim()}>반려 처리</button></div></form>}{receipt.status === 'APPROVED' && <form className="review-form reject-form" onSubmit={(e) => { e.preventDefault(); setConfirmation({ message: '정산 완료 처리하시겠습니까?', operation: () => settleReceipt(receipt.receiptId, { settledAt, comment }), success: '정산 완료 처리했습니다.' }); }}><fieldset disabled={busy}><label>정산일<input type="date" value={settledAt} onChange={(e) => setSettledAt(e.target.value)} required /></label><label>정산 의견 (선택)<textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} /></label></fieldset><button className="button primary" disabled={busy}>정산 완료 처리</button></form>}{['SUBMITTED', 'OCR_PENDING'].includes(receipt.status) && <p className="receipt-tip">OCR 처리가 완료되면 검토할 수 있습니다.</p>}{busy && <p className="muted" role="status">처리 중…</p>}{error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}{confirmation && <ConfirmAction message={confirmation.message} busy={busy} onCancel={() => setConfirmation(null)} onConfirm={() => run(confirmation.operation, confirmation.success)} />}</>;
}
function ApprovalDetail({ id, onProcessed }) {
  const { data: response, error, reload } = useApiData(`/receipts/${id}`);
  const { data: categories } = useApiData(response && !response.categoryName ? '/categories' : null);
  const { data: histories } = useApiData(`/receipts/${id}/histories`);
  if (error) return <section className="receipt-card"><p role="alert">{error}</p><button className="text-button" onClick={reload}>다시 시도</button></section>;
  if (!response) return <section className="receipt-card" role="status">상세 정보를 불러오는 중…</section>;
  const timeline = (histories || []).map((item) => ({
    ...item,
    label: historyActionLabel(item.action),
    comment: item.snapshot?.comment || '',
  }));
  const receipt = {
    ...response,
    receiptId: receiptIdOf(response),
    categoryName: categoryNameFor(response, categories),
    confidence: response.ocrResult?.confidence ?? null,
    history: timeline,
    rejectReason: [...timeline].reverse().find((item) => item.action === 'REJECTED')?.reason || '',
    settledAt: [...timeline].reverse().find((item) => item.action === 'SETTLED')?.snapshot?.settledAt || null,
  };
  return <section className="receipt-card approval-detail" aria-label="영수증 검토 상세">
    <div className="card-heading"><h2>제출 상세 #{receipt.receiptId}</h2><StatusBadge status={receipt.status} /></div>
    <div className="admin-review-columns">
      <div className="admin-original"><h3 className="section-title">원본 영수증</h3><UserReceiptImage receipt={receipt} /></div>
      <div className="admin-review-info">
        <h3 className="section-title">제출 정보</h3>
        <dl className="detail-fields"><div><dt>제출 번호</dt><dd>#{receipt.receiptId}</dd></div><div><dt>제출자</dt><dd>{submitterLabel(receipt)}</dd></div><div><dt>사용 목적</dt><dd>{receipt.purpose}</dd></div><div><dt>카테고리</dt><dd>{receipt.categoryName}</dd></div>{receipt.memo && <div><dt>메모</dt><dd>{receipt.memo}</dd></div>}</dl>
        <OcrResultDetails ocrResult={receipt.ocrResult} workflowStatus={receipt.status} finalValues={receipt} />
        {['APPROVED', 'SETTLED'].includes(receipt.status) && [receipt.merchantName, receipt.paidAt, receipt.amount].some((value) => value == null) && <p className="receipt-tip" role="status">승인된 영수증의 최종 정보 일부가 비어 있습니다. 승인 상태는 유지되며, 표시된 OCR 인식값과 저장된 최종 정보가 다를 수 있습니다.</p>}
        <div className="admin-final-actions"><DetailActions key={receipt.receiptId} receipt={receipt} onRefresh={() => { onProcessed(receipt.receiptId); reload(); }} /></div>
        {receipt.status === 'REJECTED' && receipt.rejectReason && <div className="rejection-note"><strong>반려 사유</strong><p>{receipt.rejectReason}</p></div>}
        {receipt.settledAt && <p className="muted">정산일 · {receipt.settledAt}</p>}
      </div>
    </div>
    {!!receipt.history?.length && <><h3 className="section-title">처리 이력</h3><ol className="receipt-timeline">{receipt.history.map((item, index) => <li key={index}><div className="timeline-content"><strong>{item.label === 'Mock OCR 완료' ? 'OCR 처리 완료' : item.label}</strong>{(item.reason || item.comment) && <p>{item.reason || item.comment}</p>}</div><time dateTime={item.createdAt}>{historyTimeLabel(item.createdAt)}</time></li>)}</ol></>}
  </section>;

}
export default function AdminApproval() {
  const { data, error, reload } = useApiData('/admin/receipts');
  const { data: categories } = useApiData(data?.items?.some((item) => !item.categoryName) ? '/categories' : null);
  const receipts = useMemo(() => (data?.items || []).map((item) => ({ ...item, receiptId: receiptIdOf(item) })), [data]);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState('date-desc');
  const detailRef = useRef(null);
  useEffect(() => {
    if (selectedId != null) detailRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [selectedId]);
  const visible = useMemo(() => receipts.filter((r) => filter === 'all' || (filter === 'review' ? REVIEWABLE.includes(r.status) : r.status === filter)), [receipts, filter]);
  const previews = useAdminReceiptPreviews(visible, data);
  const displayRows = searchSortReceipts(visible.map((receipt) => ({ ...receipt, ...receiptPreviewValues(receipt, previews.get(receipt.receiptId)) })), query, order, categories);
  const id = selectedId ?? displayRows[0]?.receiptId;
  return <section className="workspace-page admin-page"><div className="page-heading"><span className="eyebrow">APPROVAL MANAGEMENT</span><h1>정산 승인 관리</h1><p>원본과 OCR 결과를 검토하고 승인·반려·정산 완료를 처리하세요.</p></div><div className="admin-summary"><strong>검토 가능한 요청 <span>{receipts.filter((r) => REVIEWABLE.includes(r.status)).length}건</span></strong><span className="muted">처리 결과는 해당 사용자의 제출 현황에 반영됩니다.</span></div><div className="approval-grid"><section className="receipt-card request-list"><div className="card-heading"><h2>전체 사용자 제출 목록</h2><span className="count-label">총 {receipts.length}건</span></div><div className="filter-tabs" aria-label="상태 필터">{[['all', '전체'], ['review', '검토 필요'], ['APPROVED', '승인'], ['REJECTED', '반려'], ['SETTLED', '정산 완료']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setSelectedId(null); }}>{label}</button>)}</div><div className="admin-list-controls"><label>영수증 검색<input type="search" value={query} placeholder="번호, 제출자, 상호명, 목적, 카테고리" onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }} /></label><label>정렬<select aria-label="정렬" value={order} onChange={(e) => setOrder(e.target.value)}><option value="date-desc">제출일 최신순</option><option value="date-asc">제출일 오래된순</option><option value="amount-desc">금액 높은순</option><option value="amount-asc">금액 낮은순</option></select></label></div><p className="muted">현재 불러온 {receipts.length}건에서 검색·정렬합니다. 다른 페이지의 영수증은 포함되지 않습니다.</p>{error && <p className="error-message" role="alert">{error} <button className="text-button" onClick={reload}>다시 시도</button></p>}<div className="table-scroll"><table className="request-table admin-table"><thead><tr><th>제출자 / 사용처 / 목적</th><th>결제일</th><th>금액</th><th>상태</th></tr></thead><tbody>{displayRows.map((r) => <tr key={r.receiptId} className={id === r.receiptId ? 'selected-row' : ''}><td><button className="request-select" onClick={() => setSelectedId(r.receiptId)} aria-pressed={id === r.receiptId}><strong>{r.merchantName || (['SUBMITTED', 'OCR_PENDING'].includes(r.status) ? 'OCR 인식 대기' : '인식 결과 없음')}</strong><small>{submitterLabel(r)} · {categoryNameFor(r, categories)} · {r.purpose}</small><span className="admin-detail-link">상세 보기 ›</span></button></td><td className="admin-paid-date">{r.paidAt?.replaceAll('-', '.') || (['SUBMITTED', 'OCR_PENDING'].includes(r.status) ? '인식 대기' : '결제일 정보 없음')}</td><td className="money">{r.amount == null && !['SUBMITTED', 'OCR_PENDING'].includes(r.status) ? '금액 정보 없음' : money(r.amount)}</td><td><StatusBadge status={r.status} /></td></tr>)}</tbody></table></div>{!displayRows.length && <p className="list-empty">{data ? query.trim() ? '검색 조건에 맞는 영수증이 없습니다.' : '해당 상태의 제출 건이 없습니다.' : error ? '목록을 불러오지 못했습니다.' : '목록 불러오는 중…'}</p>}</section>{id ? <div ref={detailRef} className="admin-detail-target"><ApprovalDetail key={id} id={id} onProcessed={setSelectedId} /></div> : <div className="receipt-card empty-state">검토할 요청을 선택해주세요.</div>}</div></section>;
}
