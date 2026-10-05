export default function ReceiptImage({ receipt }) {
  return receipt.imageUrl ? <img className="review-preview" src={receipt.imageUrl} alt={`${receipt.merchantName || '제출된'} 영수증 원본`} /> : <p className="muted">원본 이미지를 불러올 수 없습니다.</p>;
}
