import type { CreateCategoryInput } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { ApiClientError } from '../../../lib/api-client'
import { adminCatalogApi } from '../api/admin-catalog.api'
import { useConfirmation } from '../../../components/feedback/confirmation-context'

const initial: CreateCategoryInput = {
  name: '',
  description: null,
  imageUrl: null,
  isActive: true,
  displayOrder: 0,
}

export function AdminCategoriesPage() {
  const client = useQueryClient()
  const confirm = useConfirmation()
  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: adminCatalogApi.categories,
  })

  const [form, setForm] = useState<CreateCategoryInput>(initial)
  const [message, setMessage] = useState('')

  const create = useMutation({
    mutationFn: adminCatalogApi.createCategory,
    onSuccess: async () => {
      setForm(initial)
      setMessage('Category created.')
      await client.invalidateQueries({ queryKey: ['admin', 'categories'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
    onError: (error) =>
      setMessage(error instanceof ApiClientError ? error.message : 'Unable to create category.'),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminCatalogApi.updateCategory(id, { isActive }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin', 'categories'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
  })

  const remove = useMutation({
    mutationFn: adminCatalogApi.removeCategory,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin', 'categories'] })
      await client.invalidateQueries({ queryKey: ['homepage'] })
    },
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (
      await confirm({
        title: 'Create this category?',
        description: `${form.name} will become available in the marketplace catalogue.`,
        confirmLabel: 'Create category',
      })
    )
      create.mutate(form)
  }

  const inputClass =
    'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-gray-500 mt-1'
  const labelClass = 'block text-sm font-medium text-gray-300 mb-4'

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Catalogue
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Categories</h1>
          <p className="text-gray-400 text-lg">Create and control the categories shown publicly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <form
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-2"
          onSubmit={(event) => void submit(event)}
        >
          <h2 className="text-xl font-bold text-white mb-6 pb-4 border-b border-white/10">
            Add category
          </h2>

          <label className={labelClass}>
            Name
            <input
              required
              minLength={2}
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>

          <label className={labelClass}>
            Description
            <textarea
              className={`${inputClass} min-h-[100px] resize-y`}
              value={form.description ?? ''}
              onChange={(event) => setForm({ ...form, description: event.target.value || null })}
            />
          </label>

          <label className={labelClass}>
            Image URL
            <input
              type="url"
              className={inputClass}
              value={form.imageUrl ?? ''}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value || null })}
            />
          </label>

          <label className={labelClass}>
            Display order
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.displayOrder}
              onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })}
            />
          </label>

          <label className="flex items-center gap-3 text-white cursor-pointer p-4 bg-black/20 rounded-xl border border-white/5 mb-6 mt-2">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-white/20 bg-black/40 text-amber-500 focus:ring-amber-500/50"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Active publicly
          </label>

          {message && (
            <p className="mb-4 text-green-400 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              {message}
            </p>
          )}

          <button
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create category'}
          </button>
        </form>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl lg:col-span-3">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Existing categories</h2>
            <span className="bg-white/10 text-white px-3 py-1 rounded-full text-sm font-medium">
              {categories.data?.length ?? 0} total
            </span>
          </div>

          {categories.isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {(categories.data ?? []).map((category) => (
                <div
                  className="p-5 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  key={category.id}
                >
                  <div className="flex items-center gap-4">
                    {category.imageUrl ? (
                      <img
                        src={category.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover bg-black/40 border border-white/10"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white font-medium text-lg">{category.name}</strong>
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${category.isActive ? 'bg-green-500/20 text-green-400 border-green-500/20' : 'bg-gray-500/20 text-gray-400 border-gray-500/20'}`}
                        >
                          {category.isActive ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <div className="text-gray-400 text-sm mt-1">
                        <span className="text-amber-400">/{category.slug}</span> · Order:{' '}
                        <span className="text-white">{category.displayOrder}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="px-3 py-1.5 text-xs font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `${category.isActive ? 'Hide' : 'Show'} ${category.name}?`,
                            description:
                              'This changes whether the category is visible to shoppers.',
                            confirmLabel: category.isActive ? 'Hide category' : 'Show category',
                          })
                        )
                          toggle.mutate({ id: category.id, isActive: !category.isActive })
                      }}
                      disabled={toggle.isPending}
                    >
                      {category.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: `Delete ${category.name}?`,
                            description:
                              'This permanently removes the category and may affect products using it.',
                            confirmLabel: 'Delete category',
                            tone: 'danger',
                          })
                        )
                          remove.mutate(category.id)
                      }}
                      disabled={remove.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {!categories.data?.length && !categories.isLoading && (
                <div className="p-12 text-center">
                  <strong className="text-white text-lg font-medium block mb-2">
                    No categories yet
                  </strong>
                  <span className="text-gray-400">Create the first category using the form.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
