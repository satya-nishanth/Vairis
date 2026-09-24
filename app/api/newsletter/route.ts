import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(5, 'Email is required')
    .max(254, 'Email must be less than 254 characters')
    .email('Please enter a valid email address'),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'newsletter', 5);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid email address' },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Record subscriber in ContactRequest table with subject 'NEWSLETTER'
  try {
    await prisma.contactRequest.create({
      data: {
        name: 'Newsletter Subscriber',
        email,
        subject: 'NEWSLETTER',
        message: 'Subscribed to storefront newsletter updates.',
      },
    });
  } catch (err) {
    console.error('[newsletter] DB save failed', err);
    // Don't fail customer experience if already saved
  }

  return NextResponse.json({ ok: true, message: 'Thank you for subscribing!' });
}
