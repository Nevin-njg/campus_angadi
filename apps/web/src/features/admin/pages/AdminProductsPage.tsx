import type { CreateOfficialProductInput } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClientError } from '../../../lib/api-client'
import { adminCatalogApi } from '../api/admin-catalog.api'
import { useConfirmation } from '../../../components/feedback/confirmation-context'

const initial: CreateOfficialProductInput = {
  title: '',
  description: '',
  categoryId: '',
  price: 0,
  originalPrice: null,
  stock: 1,
  pickupLocation: null,
  tags: [],
  isFeatured: false,
  publish: true,
  images: [],
}

export function AdminProductsPage() {
  const client = useQueryClient()
  const confirm = useConfirmation()
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminCatalogApi.categories,
  })
  const products = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => adminCatalogApi.products({ page: 1, limit: 24, sort: 'latest' }),
  })

  const [form, setForm] = useState<CreateOfficialProductInput>(initial)
  const [tags, setTags] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [message, setMessage] = useState('')

  const create = useMutation({
    mutationFn: adminCatalogApi.createProduct,
    onSuccess: async () => {
      setForm(initial)
      setTags('')
      setImageUrl('')
      setMessage('Official product created.')
      await client.invalidateQueries({ queryKey: ['admin', 'products'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : 'Unable to create product.'),
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (
      !(await confirm({
        title: 'Create this official product?',
        description: `${form.title} will be ${form.publish ? 'published to' : 'saved in'} the official store.`,
        confirmLabel: 'Create product',
      }))
    )
      return
    create.mutate({
      ...form,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      images: imageUrl
        ? [{ url: imageUrl, altText: form.title, displayOrder: 0, isPrimary: true }]
        : [],
    })
  }

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500 mt-1'
  const labelClass = 'block text-sm font-medium text-gray-300'

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Official store
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Products</h1>
          <p className="text-gray-400 text-lg">
            Add official products and review the current catalogue.
          </p>
        </div>
      </div>

      <details
        className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl group [&_summary::-webkit-details-marker]:hidden"
        open
      >
        <summary className="p-6 flex items-center justify-between cursor-pointer list-none border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Add official product</h2>
          <span className="text-gray-400 group-open:rotate-180 transition-transform duration-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </summary>

        <form
          className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
          onSubmit={(event) => void submit(event)}
        >
          <div>
            <label className={labelClass}>
              Title
              <input
                required
                minLength={3}
                className={inputClass}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Category
              <select
                required
                className={`${inputClass} appearance-none`}
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Choose category</option>
                {(categories.data ?? [])
                  .filter((category) => category.isActive)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>
              Description
              <textarea
                required
                minLength={10}
                className={`${inputClass} min-h-[100px] resize-y`}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Price (₹)
              <input
                required
                type="number"
                min="0"
                className={inputClass}
                value={form.price}
                onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Original price (₹)
              <input
                type="number"
                min="0"
                className={inputClass}
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
          <div>
            <label className={labelClass}>
              Stock
              <input
                required
                type="number"
                min="0"
                className={inputClass}
                value={form.stock}
                onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })}
              />
            </label>
          </div>
          <div>
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
          </div>
          <div>
            <label className={labelClass}>
              Primary image URL
              <input
                type="url"
                className={inputClass}
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </label>
          </div>
          <div>
            <label className={labelClass}>
              Tags, comma separated
              <input
                className={inputClass}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </label>
          </div>
          <div className="md:col-span-2 flex items-center gap-6 p-4 bg-black/20 rounded-xl border border-white/5">
            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/50"
                checked={form.isFeatured}
                onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
              />
              Featured priority
            </label>
            <label className="flex items-center gap-3 text-white cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/50"
                checked={form.publish}
                onChange={(event) => setForm({ ...form, publish: event.target.checked })}
              />
              Publish immediately
            </label>
          </div>

          <div className="md:col-span-2">
            {message ? (
              <p className="mb-4 text-green-400 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                {message}
              </p>
            ) : null}
            <button
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create product'}
            </button>
          </div>
        </form>
      </details>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Catalogue</h2>
          <span className="bg-white/10 text-white px-3 py-1 rounded-full text-sm font-medium">
            {products.data?.meta.total ?? 0} products
          </span>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(products.data?.items ?? []).map((product) => (
              <article
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                key={product.id}
              >
                {product.primaryImage ? (
                  <img
                    className="w-20 h-20 object-cover rounded-lg bg-black/40"
                    src={product.primaryImage.url}
                    alt={product.primaryImage.altText || product.title}
                  />
                ) : (
                  <span className="w-20 h-20 rounded-lg bg-black/40 flex items-center justify-center text-gray-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <strong className="text-white font-medium block truncate text-lg">
                    {product.title}
                  </strong>
                  <div className="text-gray-400 text-sm mt-1">
                    <span className="text-amber-400">{product.category.name}</span> ·{' '}
                    <span className="font-medium text-white">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>{' '}
                    · {product.stock} in stock
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${product.published ? 'bg-green-500/20 text-green-400 border-green-500/20' : 'bg-gray-500/20 text-gray-400 border-gray-500/20'}`}
                    >
                      {product.published ? 'Published' : 'Unpublished'}
                    </span>
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${product.isFeatured ? 'bg-amber-500/20 text-amber-300 border-amber-500/20' : 'bg-white/5 text-gray-400 border-white/10'}`}
                    >
                      {product.isFeatured ? 'Featured' : 'Standard'}
                    </span>
                  </div>
                </div>
                <Link
                  className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  to={`/admin/products/${product.id}/edit`}
                >
                  Edit
                </Link>
              </article>
            ))}
          </div>

          {!products.data?.items.length && !products.isLoading && (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <strong className="text-white text-xl font-medium block mb-2">No products yet</strong>
              <span className="text-gray-400">Create the first official product above.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
