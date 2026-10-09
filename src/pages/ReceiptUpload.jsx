import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { submitReceipt, MAX_RECEIPT_SIZE, RECEIPT_IMAGE_TYPES } from '../api/receipts';
import useReceiptPreview from '../hooks/useReceiptPreview';
import './Receipts.css';
import './ReceiptUpload.css';
import { useApiData } from '../hooks/useMockData';

function ReceiptUpload() {
  const { state } = useLocation();
  const resubmission = state?.resubmission;
  const { data: categories, error: categoryError, reload } = useApiData('/categories');
  const [purpose, setPurpose] = useState(() => typeof resubmission?.purpose === 'string' ? resubmission.purpose : '');
  const [categoryId, setCategoryId] = useState(() => resubmission?.categoryId != null ? String(resubmission.categoryId) : '');
  const selectedCategoryId = categories?.some((category) => String(category.id) === categoryId) ? categoryId : '';
  const [memo, setMemo] = useState(() => typeof resubmission?.memo === 'string' ? resubmission.memo : '');
  const [submitted, setSubmitted] = useState(null);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const preview = useReceiptPreview(file);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);


  function selectFile(selected) {
    if (busy || !selected) return;
    setError('');
    if (!RECEIPT_IMAGE_TYPES.includes(selected.type) || selected.size > MAX_RECEIPT_SIZE) {
      setError('10MB 이하의 JPG, PNG, WEBP 이미지만 등록할 수 있습니다.');
      return;
    }
    setFile(selected);
  }
  async function handleExtract(event) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!purpose.trim() || !selectedCategoryId) throw new Error('사용 목적과 카테고리를 입력해주세요.');
      const response = await submitReceipt({ image: file, purpose: purpose.trim(), categoryId: Number(selectedCategoryId), memo: memo.trim() });
      setSubmitted(response);
    } catch (err) {
      setError(err.message || '영수증 제출에 실패했습니다. 다시 시도해주세요.');
    } finally { setBusy(false); }
  }
  if (submitted) return <section className="receipt-page receipt-card empty-state" role="status"><span className="mock-badge">OCR 처리 중</span><h1>영수증이 제출되었어요</h1><p>{submitted.message}</p>{resubmission && <p>새 영수증이 생성되었습니다. 기존 반려 영수증과 반려 사유는 그대로 유지됩니다.</p>}<p>제출 번호 #{submitted.data.receiptId} · OCR 처리 중<br />OCR 완료 후 관리자가 원본과 결과를 검토합니다.</p><Link className="button primary" to="/dashboard">내 제출 현황 확인</Link></section>;
  return (
    <section className="receipt-page receipt-upload-page">
      <div className="page-heading"><span className="eyebrow">NEW RECEIPT</span><h1>영수증을 등록해주세요</h1><p>이미지와 사용 목적을 제출하면 OCR 처리 후 관리자가 검토합니다.</p></div>
      {resubmission && <p className="receipt-tip">반려된 영수증을 새 영수증으로 다시 제출합니다. 이미지를 새로 선택해 주세요.</p>}
      <ol className="receipt-steps" aria-label="정산 등록 단계"><li aria-current={!file ? 'step' : undefined}><b>{file ? '✓' : '1'}</b> 이미지 등록</li><li aria-current={file ? 'step' : undefined}><b>2</b> 제출 정보 입력</li></ol>
      <form className="receipt-card review-form" onSubmit={handleExtract}>
        <div className="card-heading"><h2>영수증 이미지</h2></div>
        <input ref={inputRef} id="receipt-file" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ''; }} />
        <div className={`upload-zone${dragging ? ' dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) { setError('영수증은 한 장씩 등록해주세요.'); return; } selectFile(event.dataTransfer.files[0]); }}>
          {preview ? <img className="receipt-preview" src={preview} alt="선택한 영수증 미리보기" onError={() => { setError('이미지를 읽을 수 없습니다. 다른 파일을 선택해주세요.'); setFile(null); }} /> : <><div className="upload-symbol" aria-hidden="true">↑</div><h3>영수증 사진을 올려주세요</h3></>}
          <button type="button" className="button secondary" disabled={busy} onClick={() => inputRef.current?.click()}>{file ? '이미지 변경' : '이미지 선택'}</button>
          <span className="file-hint">JPG, PNG, WEBP · 최대 10MB</span>
        </div>
        {file && <div className="file-details"><span>{file.name} <small>({(file.size / 1024 / 1024).toFixed(2)} MB)</small></span><button type="button" className="text-button" disabled={busy} onClick={() => { setFile(null); setError(''); }}>삭제</button></div>}
        <fieldset disabled={busy}>
          <label htmlFor="purpose">사용 목적 (필수)<textarea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required maxLength={500} rows={1} placeholder="예: 운영진 회의 음료 구입" /></label>
          <label htmlFor="category">카테고리 (필수)<select id="category" value={selectedCategoryId} onChange={(e) => setCategoryId(e.target.value)} required disabled={!categories}><option value="">{categories ? '카테고리를 선택해주세요' : '카테고리 불러오는 중…'}</option>{categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label htmlFor="memo">메모 (선택)<textarea id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={1000} rows={3} placeholder="추가로 전달할 내용이 있다면 입력해주세요." /></label>
        </fieldset>
        {categoryError && <p className="error-message" role="alert">{categoryError} <button type="button" className="text-button" onClick={reload}>다시 불러오기</button></p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="receipt-tip"><strong>더 정확하게 인식하려면</strong><p>영수증 전체가 보이도록 밝은 곳에서 촬영해주세요. 사용처, 결제일, 금액이 선명하면 좋습니다.</p></div>
        <p className="upload-submit-note muted" role="status">{busy ? '영수증을 제출하고 있습니다…' : '제출 후 OCR 처리 상태를 내 제출 현황에서 확인할 수 있어요.'}</p><div className="form-actions upload-actions"><Link className="button secondary" to="/dashboard" aria-disabled={busy} onClick={(event) => { if (busy) event.preventDefault(); }}>취소</Link><button className="button primary" disabled={!file || !preview || !categories || !purpose.trim() || !selectedCategoryId || busy} type="submit">{busy ? '제출 중…' : '영수증 제출'}</button></div>
      </form>
    </section>
  );
}
export default ReceiptUpload;
