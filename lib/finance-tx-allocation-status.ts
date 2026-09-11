import { roundMoney } from '@/lib/finance'

export type TxAllocationStatus = 'unallocated' | 'partial' | 'allocated' | 'over_allocated'

export function txAllocationStatus(
  amount: number,
  allocated: number,
): { status: TxAllocationStatus; unallocatedAmount: number; overAllocatedAmount: number } {
  const total = roundMoney(amount)
  const used = roundMoney(allocated)
  if (used <= 0.009) {
    return { status: 'unallocated', unallocatedAmount: total, overAllocatedAmount: 0 }
  }
  if (used > total + 0.009) {
    return {
      status: 'over_allocated',
      unallocatedAmount: 0,
      overAllocatedAmount: roundMoney(used - total),
    }
  }
  if (used < total - 0.009) {
    return {
      status: 'partial',
      unallocatedAmount: roundMoney(total - used),
      overAllocatedAmount: 0,
    }
  }
  return { status: 'allocated', unallocatedAmount: 0, overAllocatedAmount: 0 }
}

export const TX_ALLOCATION_LABEL: Record<TxAllocationStatus, string> = {
  unallocated: 'Unallocated',
  partial: 'Partial',
  allocated: 'Fully allocated',
  over_allocated: 'Over-allocated',
}
