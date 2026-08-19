import { z } from 'zod'

const baseAddressSchema = z.object({
  label: z.string().trim().max(30).optional(),
  contactName: z.string().trim().min(2, 'Name is required'),
  contactPhone: z.string().trim().min(1, 'Phone number is required'),
  line1: z.string().trim().min(5, 'Address is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().min(1, 'Pincode is required'),
  country: z.string().trim().min(2, 'Country is required').max(60).default('IN'),
  isDefault: z.boolean().optional(),
})

function checkIndiaFormat(data: { country: string; contactPhone: string; pincode: string }, ctx: z.RefinementCtx) {
  if (data.country !== 'IN') return
  if (!/^\d{10}$/.test(data.contactPhone)) {
    ctx.addIssue({ code: 'custom', path: ['contactPhone'], message: 'Enter a 10-digit mobile number' })
  }
  if (!/^\d{6}$/.test(data.pincode)) {
    ctx.addIssue({ code: 'custom', path: ['pincode'], message: 'Enter a 6-digit pincode' })
  }
}

/**
 * Full-object validation — used for creating an address (POST) and checkout.
 * India ("IN") gets strict, courier-serviceable format checks (10-digit
 * phone, 6-digit pincode); any other country is manual/free-text.
 */
export const addressSchema = baseAddressSchema.superRefine(checkIndiaFormat)

/**
 * zod 4 disallows `.partial()` on a schema carrying `.superRefine()` (it
 * throws at runtime, not just a type error) — used for PATCH, where only
 * provided fields are validated. This intentionally does NOT re-run the
 * India strict-format check on partial updates. A country/pincode
 * serviceability check for PATCH is planned for a later task (see
 * docs/superpowers/plans/2026-08-19-sequel247-delivery-address-validation.md,
 * Task 4) — not implemented yet as of this schema change.
 */
export const partialAddressSchema = baseAddressSchema.partial()

export type AddressInput = z.infer<typeof baseAddressSchema>
