import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('products').select('id,sku,name,barcode,base_unit,pack_size,price,tax_rate,inventory_enabled,stock_quantity').eq('owner_id', user.id).order('name')
  if (error) return NextResponse.json({ error: 'Unable to load catalogue' }, { status: 500 })
  return NextResponse.json({ products: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const input = { owner_id: user.id, sku: String(body.sku ?? '').trim(), name: String(body.name ?? '').trim(), barcode: body.barcode ? String(body.barcode).trim() : null, base_unit: body.base_unit, pack_size: Number(body.pack_size), price: Number(body.price), tax_rate: Number(body.tax_rate ?? 0), inventory_enabled: Boolean(body.inventory_enabled), stock_quantity: Number(body.stock_quantity ?? 0) }
  if (!input.sku || !input.name || !['piece', 'gram', 'millilitre'].includes(input.base_unit) || !Number.isFinite(input.pack_size) || input.pack_size <= 0 || !Number.isFinite(input.price) || input.price < 0) return NextResponse.json({ error: 'Invalid product details' }, { status: 400 })
  const { data, error } = await supabase.from('products').insert(input).select().single()
  if (error) return NextResponse.json({ error: 'Could not save product' }, { status: 400 })
  return NextResponse.json({ product: data }, { status: 201 })
}
