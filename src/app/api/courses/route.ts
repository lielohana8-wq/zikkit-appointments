import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField } from '@/lib/firestore-admin';

/**
 * Courses & Products for appointment businesses.
 * GET  /api/courses?bizId=xxx       → list products
 * POST /api/courses                 → create/update/delete a product
 *
 * A "product" = digital course, package (כרטיסייה), or physical product.
 */

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get('bizId');
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });
    const biz = await getBiz(bizId);
    const products = ((biz?.products as Record<string, unknown>)?.items as unknown[]) || [];
    return NextResponse.json({ success: true, products });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bizId, action, product } = body;
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });

    const biz = await getBiz(bizId);
    let items = (((biz?.products as Record<string, unknown>)?.items) as Array<Record<string, unknown>>) || [];

    if (action === 'create') {
      const newProduct = {
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: product.type || 'course', // course | package | physical
        name: product.name || '',
        description: product.description || '',
        price: product.price || 0,
        // For courses: video/content URL. For packages: number of sessions.
        contentUrl: product.contentUrl || '',
        sessions: product.sessions || null,
        active: true,
        createdAt: new Date().toISOString(),
        sales: 0,
      };
      items = [newProduct, ...items];
    } else if (action === 'update') {
      items = items.map((p) => (p.id === product.id ? { ...p, ...product } : p));
    } else if (action === 'delete') {
      items = items.filter((p) => p.id !== product.id);
    }

    await setBizField(bizId, ['products', 'items'], items);
    return NextResponse.json({ success: true, products: items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
