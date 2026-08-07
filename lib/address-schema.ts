import { z } from 'zod'

export const addressSchema = z.object({
  label: z.string().trim().max(30).optional(),
  contactName: z.string().trim().min(2, 'Name is required'),
  contactPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number'),
  line1: z.string().trim().min(5, 'Address is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
  isDefault: z.boolean().optional(),
})
