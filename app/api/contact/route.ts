import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { rateLimit } from '@/lib/rate-limit'

const schema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(80),
    email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10}$/, 'Enter a 10-digit mobile number')
      .optional()
      .or(z.literal('')),
    subject: z.string().trim().max(120).optional(),
    message: z.string().trim().min(5, 'Message is required').max(3000),
  })
  .refine((d) => (d.email && d.email.length > 0) || (d.phone && d.phone.length > 0), {
    message: 'Provide an email or a mobile number so we can reply',
  })

/**
 * POST /api/contact — stores the request and best-effort notifies the team
 * via Resend. Replaces the old fake-success contact form.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'contact', 5)
  if (limited) return limited

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const request = await prisma.contactRequest.create({
    data: {
      name: d.name,
      email: d.email || '',
      phone: d.phone || null,
      subject: d.subject || null,
      message: d.message,
    },
  })

  // Best-effort email to the team — DB row is the source of truth.
  if (process.env.RESEND_API_KEY) {
    const to = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (to.length) {
      new Resend(process.env.RESEND_API_KEY).emails
        .send({
          from: process.env.EMAIL_FROM ?? 'VAIRIS <orders@thevairis.com>',
          to,
          subject: `Contact form: ${d.subject || d.name}`,
          html: `<p><strong>${d.name}</strong> (${d.email}${d.phone ? `, ${d.phone}` : ''})</p><p>${d.message.replace(/\n/g, '<br/>')}</p><p>Ref: ${request.id}</p>`,
        })
        .catch((err) => console.error('[contact] notify failed', err))
    }
  }

  return NextResponse.json({ ok: true, id: request.id }, { status: 201 })
}
