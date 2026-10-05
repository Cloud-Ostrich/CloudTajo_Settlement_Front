function openImages() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('duesflow-images', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('영수증 이미지 저장소를 열 수 없습니다.'));
  });
}
export async function saveImage(id, file) {
  const db = await openImages();
  try { await new Promise((resolve, reject) => {
    const transaction = db.transaction('images', 'readwrite');
    transaction.objectStore('images').put(file, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(new Error('영수증 이미지 저장에 실패했습니다.'));
    transaction.onabort = () => reject(new Error('영수증 이미지 저장이 취소되었습니다.'));
  }); } finally { db.close(); }
}
export async function imageUrl(image, fileName) {
  if (image.storage === 'inline') return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`;
  const db = await openImages();
  try {
    const file = await new Promise((resolve, reject) => {
      const request = db.transaction('images').objectStore('images').get(image.key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('원본 이미지를 불러오지 못했습니다.'));
    });
    if (!file) return null;
    // 이미지 URL은 응답 모델에서만 제공하고 저장 모델에는 넣지 않습니다.
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`${fileName} 이미지를 읽지 못했습니다.`));
      reader.readAsDataURL(file);
    });
  } finally { db.close(); }
}
