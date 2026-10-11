import { useEffect, useRef } from 'react';
export default function ConfirmAction({ message, busy, onCancel, onConfirm }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="ux-dialog confirm-dialog" aria-label="처리 확인" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}><h2>{message}</h2><p>확인하면 처리 결과가 영수증에 반영됩니다.</p><div className="decision-actions"><button className="button secondary" disabled={busy} onClick={onCancel}>취소</button><button className="button primary" disabled={busy} onClick={onConfirm}>{busy ? '처리 중…' : '확인'}</button></div></dialog>;
}
