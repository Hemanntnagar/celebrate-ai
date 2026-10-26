import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const items = Array.isArray(body.items) ? body.items : []
  const discount = Number(body.discount ?? 0)
  const idempotencyKey = String(body.idempotency_key ?? '').trim()
  if (!items.length || !idempotencyKey || !Number.isFinite(discount) || discount < 0) return NextResponse.json({ error: 'A non-empty bill and valid discount are required' }, { status: 400 })
  const ids = items.map((item: { product_id: string }) => item.product_id)
  const { data: products, error: productsError } = await supabase.from('products').select('id,name,base_unit,pack_size,price,tax_rate,inventory_enabled,stock_quantity').eq('owner_id', user.id).in('id', ids)
  if (productsError || !products || products.length !== new Set(ids).size) return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 })
  const byId = new Map(products.map((product) => [product.id, product]))
  const lines = items.map((item: { product_id: string; quantity: number }) => {
    const product = byId.get(item.product_id)
    const quantity = Number(item.quantity)
    if (!product || !Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid quantity')
    const subtotal = round(Number(product.price) * quantity)
    const tax = round(subtotal * Number(product.tax_rate) / 100)
    return { product_id: product.id, product_name_snapshot: product.name, unit_snapshot: product.base_unit, price_snapshot: product.price, tax_rate_snapshot: product.tax_rate, quantity, line_subtotal: subtotal, line_tax: tax, line_total: round(subtotal + tax) }
  })
  try {
    const subtotal = round(lines.reduce((sum: number, line: { line_subtotal: number }) => sum + line.line_subtotal, 0))
    if (discount > subtotal) return NextResponse.json({ error: 'Discount cannot exceed subtotal' }, { status: 400 })
    const taxTotal = round(lines.reduce((sum: number, line: { line_tax: number }) => sum + line.line_tax, 0))
    const total = round(subtotal - discount + taxTotal)
    const { data: existing } = await supabase.from('sales').select('id,invoice_number,state,total').eq('owner_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle()
    if (existing) return NextResponse.json({ sale: existing, duplicate: true })
    const { data: invoice, error } = await supabase.from('sales').insert({ owner_id: user.id, invoice_number: `INV-${Date.now().toString().slice(-6)}`, state: 'confirmed', currency: 'INR', discount, subtotal, tax_total: taxTotal, total, idempotency_key: idempotencyKey }).select().single()
    if (error || !invoice) throw new Error('Could not create invoice')
    const { error: linesError } = await supabase.from('sale_lines').insert(lines.map((line: Record<string, unknown>) => ({ ...line, sale_id: invoice.id })))
    if (linesError) throw new Error('Could not save invoice lines')
    await supabase.from('sale_audit_log').insert({ owner_id: user.id, sale_id: invoice.id, to_state: 'confirmed', reason: 'Manual sale' })
    return NextResponse.json({ sale: invoice, lines })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to finalize sale' }, { status: 400 })
  }
}
