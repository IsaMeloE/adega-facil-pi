function compareDates(first, second) {
  const firstTime = first ? new Date(first).getTime() : Number.POSITIVE_INFINITY;
  const secondTime = second
    ? new Date(second).getTime()
    : Number.POSITIVE_INFINITY;

  return firstTime - secondTime;
}

export function allocateLotsFefo({
  lots,
  quantity,
  remainingByLotId = new Map(),
  startOfDay,
  productName,
}) {
  const eligibleLots = lots
    .filter(
      (lot) =>
        lot.quantity > 0 &&
        (!lot.expiresAt || new Date(lot.expiresAt) >= startOfDay),
    )
    .sort((first, second) => {
      const expiryComparison = compareDates(first.expiresAt, second.expiresAt);

      if (expiryComparison !== 0) {
        return expiryComparison;
      }

      return compareDates(first.createdAt, second.createdAt);
    });

  let remainingQuantity = quantity;
  const allocations = [];
  const nextRemainingByLotId = new Map(remainingByLotId);
  const deductionsByLotId = new Map();

  for (const lot of eligibleLots) {
    if (remainingQuantity === 0) break;

    const lotRemaining =
      nextRemainingByLotId.get(lot.id) ?? lot.quantity;
    const quantityFromLot = Math.min(remainingQuantity, lotRemaining);

    if (quantityFromLot === 0) continue;

    allocations.push({ lot, quantity: quantityFromLot });
    nextRemainingByLotId.set(lot.id, lotRemaining - quantityFromLot);
    remainingQuantity -= quantityFromLot;
    deductionsByLotId.set(lot.id, quantityFromLot);
  }

  if (remainingQuantity > 0) {
    throw Object.assign(
      new Error(`Estoque válido insuficiente para ${productName}.`),
      { status: 409 },
    );
  }

  return {
    allocations,
    remainingByLotId: nextRemainingByLotId,
    deductionsByLotId,
  };
}
