import type { UpdateOfficialProductInput } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiClientError } from '../../../lib/api-client'
import { adminCatalogApi } from '../api/admin-catalog.api'
import { ChevronLeftIcon, PackageIcon } from '../../../components/ui/icons'
import { useConfirmation } from '../../../components/feedback/confirmation-context'

export function AdminProductEditPage() {
  const { id = '' } = useParams()
  const client = useQueryClient()
  const confirm = useConfirmation()
  const product = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => adminCatalogApi.product(id),
    enabled: Boolean(id),
  })

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminCatalogApi.categories,
  })

  const [form, setForm] = useState<UpdateOfficialProductInput>({})
  const [imageUrl, setImageUrl] = useState('')
  const [tags, setTags] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!product.data) return
    setForm({
      title: product.data.title,
      description: product.data.description,
      categoryId: product.data.category.id,
      price: product.data.price,
      originalPrice: product.data.originalPrice,
      stock: product.data.stock,
      pickupLocation: product.data.pickupLocation,
      isFeatured: product.data.isFeatured,
      publish: product.data.published,
    })
    setTags(product.data.tags.join(', '))
    setImageUrl(
      product.data.images.find((image) => image.isPrimary)?.url ??
        product.data.images[0]?.url ??
        '',
    )
  }, [product.data])

  const update = useMutation({
    mutationFn: (input: UpdateOfficialProductInput) => adminCatalogApi.updateProduct(id, input),
    onSuccess: async () => {
      setMessage('Product updated successfully.')
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'product', id] }),
        client.invalidateQueries({ queryKey: ['admin', 'products'] }),
        client.invalidateQueries({ queryKey: ['admin', 'homepage'] }),
        client.invalidateQueries({ queryKey: ['homepage'] }),
        client.invalidateQueries({ queryKey: ['products'] }),
      ])
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : 'Unable to update product.'),
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (
      !(await confirm({
        title: 'Save product changes?',
        description: 'The official-store product and its public visibility will be updated.',
        confirmLabel: 'Save product',
      }))
    )
      return
    update.mutate({
      ...form,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      images: imageUrl
        ? [{ url: imageUrl, altText: form.title ?? '', displayOrder: 0, isPrimary: true }]
        : [],
    })
  }

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500 mt-1'
  const labelClass = 'block text-sm font-medium text-gray-300'

  if (product.isLoading)
    return (
      <div className="py-20 flex justify-center">
        <div className="w-12 h-12 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
      </div>
    )

  if (!product.data || product.isError)
    return (
      <div className="py-20 text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
          <PackageIcon />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Product not found</h2>
        <Link to="/admin/products" className="text-amber-400 hover:text-amber-300">
          Return to products
        </Link>
      </div>
    )

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <Link
        className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors"
        to="/admin/products"
      >
        <ChevronLeftIcon /> Back to Products
      </Link>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Official store
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Edit product</h1>
          <p className="text-gray-400 text-lg">
            Changes are applied to the live catalogue and homepage eligibility.
          </p>
        </div>
      </div>

      <form
        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl"
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10">
              Basic Details
            </h2>

            <label className={labelClass}>
              Title
              <input
                className={inputClass}
                required
                minLength={3}
                value={form.title ?? ''}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>

            <label className={labelClass}>
              Category
              <select
                className={`${inputClass} appearance-none`}
                required
                value={form.categoryId ?? ''}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Choose category</option>
                {(categories.data ?? [])
                  .filter(
                    (category) => category.isActive || category.id === product.data.category.id,
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className={labelClass}>
              Description
              <textarea
                className={`${inputClass} min-h-[150px] resize-y`}
                required
                minLength={10}
                value={form.description ?? ''}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10">
              Pricing & Inventory
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <label className={labelClass}>
                Price (₹)
                <input
                  className={inputClass}
                  required
                  type="number"
                  min="0"
                  value={form.price ?? 0}
                  onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
                />
              </label>

              <label className={labelClass}>
                Original price (₹)
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={form.originalPrice ?? ''}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      originalPrice: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                />
              </label>
            </div>

            <label className={labelClass}>
              Stock
              <input
                className={inputClass}
                required
                type="number"
                min="0"
                value={form.stock ?? 0}
                onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })}
              />
            </label>

            <label className={labelClass}>
              Pickup location
              <input
                className={inputClass}
                value={form.pickupLocation ?? ''}
                onChange={(event) =>
                  setForm({ ...form, pickupLocation: event.target.value || null })
                }
              />
            </label>

            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10 mt-8">
              Media & Tags
            </h2>

            <label className={labelClass}>
              Primary image URL
              <input
                className={inputClass}
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </label>

            {imageUrl && (
              <div className="mt-2 rounded-xl border border-white/10 overflow-hidden bg-black/40 h-32 relative">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
              </div>
            )}

            <label className={labelClass}>
              Tags, comma separated
              <input
                className={inputClass}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </label>

            <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-white/10">
              <label className="flex items-center gap-3 text-white cursor-pointer p-4 bg-black/20 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/50"
                  checked={form.isFeatured ?? false}
                  onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
                />
                <span className="font-medium">Featured priority</span>
              </label>

              <label className="flex items-center gap-3 text-white cursor-pointer p-4 bg-black/20 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/50"
                  checked={form.publish ?? false}
                  onChange={(event) => setForm({ ...form, publish: event.target.checked })}
                />
                <span className="font-medium">Published publicly</span>
              </label>
            </div>
          </div>
        </div>

        {message ? (
          <div
            className={`mt-8 p-4 rounded-xl border text-sm font-medium ${
              message.includes('successfully')
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="mt-8 pt-8 border-t border-white/10 flex justify-end">
          <button
            type="submit"
            className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed text-lg"
            disabled={update.isPending}
          >
            {update.isPending ? 'Saving changes…' : 'Save changes'}
          </button>
        </div>
      </form>
    </section>
  )
}
