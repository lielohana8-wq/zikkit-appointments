import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField } from '@/lib/firestore-admin';

/**
 * Work gallery — stores image data URLs (or hosted URLs) on the business doc.
 * These appear on the auto-generated landing page.
 *
 * GET  /api/gallery?bizId=xxx   → list images
 * POST /api/gallery             → add/remove an image
 *
 * NOTE: For production with many/large images, switch to Firebase Storage
 * and store only the download URLs here. For pilot, data URLs are fine
 * (kept small; Firestore field limit is 1MB per document).
 */

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get('bizId');
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });
    const biz = await getBiz(bizId);
    const images = ((biz?.gallery as Record<string, unknown>)?.images as string[]) || [];
    return NextResponse.json({ success: true, images });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bizId, action, imageUrl, index } = body;
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });

    const biz = await getBiz(bizId);
    let images = (((biz?.gallery as Record<string, unknown>)?.images) as string[]) || [];

    if (action === 'add' && imageUrl) {
      if (images.length >= 12) {
        return NextResponse.json({ error: 'מקסימום 12 תמונות בגלריה' }, { status: 400 });
      }
      images = [...images, imageUrl];
    } else if (action === 'remove' && typeof index === 'number') {
      images = images.filter((_, i) => i !== index);
    }

    await setBizField(bizId, ['gallery', 'images'], images);
    return NextResponse.json({ success: true, images });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
