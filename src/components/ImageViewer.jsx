import { useEffect, useRef, useState } from 'react';
export default function ImageViewer({ src, alt, onClose }) {
  const ref = useRef(null), drag = useRef(null);
  const [scale, setScale] = useState(1), [rotation, setRotation] = useState(0), [position, setPosition] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const zoom = (delta) => setScale((value) => Math.max(.5, Math.min(5, value + delta)));
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="ux-dialog image-viewer" aria-label="영수증 확대 보기" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <div className="viewer-toolbar"><h2>영수증 확대 보기</h2><button className="button secondary" onClick={onClose}>닫기</button></div>
    <div className="viewer-controls"><button onClick={() => zoom(-.25)} aria-label="축소">−</button><span role="status">{Math.round(scale * 100)}%</span><button onClick={() => zoom(.25)} aria-label="확대">+</button><button onClick={() => setRotation((v) => v - 90)}>왼쪽 회전</button><button onClick={() => setRotation((v) => v + 90)}>오른쪽 회전</button><button onClick={() => { setScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); }}>초기화</button></div>
    <p className="muted">이미지를 끌어 이동하세요. 확대·회전은 원본을 변경하지 않습니다.</p>
    <div className="viewer-stage" onWheel={(e) => zoom(e.deltaY < 0 ? .1 : -.1)} onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, position }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (drag.current) setPosition({ x: drag.current.position.x + e.clientX - drag.current.x, y: drag.current.position.y + e.clientY - drag.current.y }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {failed ? <p>원본 이미지를 불러올 수 없습니다.</p> : <img src={src} alt={alt} draggable="false" onError={() => setFailed(true)} style={{ transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})` }} />}
    </div>
  </dialog>;
}
