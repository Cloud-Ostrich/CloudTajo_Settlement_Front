const nonempty = (value) => typeof value === 'string' && value.trim() ? value : null;
export function rejectionReasonFor(receipt, histories = []) {
  const rejections = histories.map((item, index) => ({ item, index }))
    .filter(({ item }) => ['REJECT', 'REJECTED'].includes(item.action))
    .sort((a, b) => {
      const aTime = Date.parse(a.item.createdAt), bTime = Date.parse(b.item.createdAt);
      return (Number.isFinite(bTime) ? bTime : -Infinity) - (Number.isFinite(aTime) ? aTime : -Infinity) || b.index - a.index;
    });
  for (const { item } of rejections) {
    const reason = nonempty(item.reason) || nonempty(item.snapshot?.comment);
    if (reason) return reason;
  }
  return nonempty(receipt?.rejectReason);
}
