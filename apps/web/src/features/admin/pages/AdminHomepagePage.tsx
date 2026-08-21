import type {
  DynamicHomepageSection,
  DynamicHomepageSectionType,
  HomepageSectionConfiguration,
  ProductSummary,
} from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertIcon,
  PackageIcon,
  SearchIcon,
} from '../../../components/ui/icons'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import { ApiClientError } from '../../../lib/api-client'
import { storesApi } from '../../stores/api/stores.api'
import { ProductGrid } from '../../products/components/ProductGrid'
import { adminCatalogApi } from '../api/admin-catalog.api'

type EditableSection = {
  title: string
  enabled: boolean
  displayOrder: number
  limit: number
  departmentId: string | null
  productIds: string[]
  storeIds: string[]
}

const typeLabels: Record<DynamicHomepageSectionType, string> = {
  FEATURED_PRODUCTS: 'Featured Products',
  POPULAR_PRODUCTS: 'Popular Products',
  STORE_CATEGORY: 'Store Category',
  SECOND_HAND_PRODUCTS: 'Second Hand',
}

function toEditable(
  config: HomepageSectionConfiguration,
): EditableSection {
  return {
    title: config.title,
    enabled: config.enabled,
    displayOrder: config.displayOrder,
    limit: config.limit,
    departmentId: config.departmentId,
    productIds: [...config.manualProductIds],
    storeIds: [...config.manualStoreIds],
  }
}

export function AdminHomepagePage() {
  const client = useQueryClient()
  const confirm = useConfirmation()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditableSection | null>(null)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const homepage = useQuery({
    queryKey: ['admin', 'dynamic-homepage'],
    queryFn: adminCatalogApi.dynamicHomepage,
  })

  const departments = useQuery({
    queryKey: ['admin', 'store-departments'],
    queryFn: storesApi.adminDepartments,
  })

  const stores = useQuery({
    queryKey: ['admin', 'stores'],
    queryFn: storesApi.adminList,
  })

  const products = useQuery({
    queryKey: ['admin', 'homepage-products', search],
    queryFn: () =>
      adminCatalogApi.products({
        q: search || undefined,
        page: 1,
        limit: 48,
        sort: 'latest',
        status: 'APPROVED',
      }),
  })

  const configurations = useMemo(
    () =>
      [...(homepage.data?.configuration ?? [])].sort(
        (a, b) => a.displayOrder - b.displayOrder,
      ),
    [homepage.data],
  )

  useEffect(() => {
    if (!configurations.length) {
      setSelectedId(null)
      setDraft(null)
      return
    }

    const current =
      configurations.find((item) => item.id === selectedId) ??
      configurations[0]!

    if (current.id !== selectedId) {
      setSelectedId(current.id)
    }

    setDraft(toEditable(current))
  }, [configurations, selectedId])

  const selectedConfig =
    configurations.find((item) => item.id === selectedId) ?? null

  const publishedSection: DynamicHomepageSection | undefined =
    homepage.data?.sections.find((item) => item.id === selectedId)

  const productMap = useMemo(() => {
    const values: ProductSummary[] = [
      ...(products.data?.items ?? []),
      ...(publishedSection?.products ?? []),
    ]

    return new Map(values.map((product) => [product.id, product]))
  }, [products.data, publishedSection])

  const productCandidates = useMemo(() => {
    if (!selectedConfig) return []

    return (products.data?.items ?? []).filter((product) => {
      if (selectedConfig.type === 'FEATURED_PRODUCTS') {
        return product.productType === 'NEW'
      }

      if (selectedConfig.type === 'SECOND_HAND_PRODUCTS') {
        return (
          product.productType === 'SECOND_HAND' &&
          product.sellerType === 'USER'
        )
      }

      return false
    })
  }, [products.data, selectedConfig])

  const storeCandidates = useMemo(() => {
    if (
      !selectedConfig ||
      selectedConfig.type !== 'STORE_CATEGORY' ||
      !draft?.departmentId
    ) {
      return []
    }

    return (stores.data ?? []).filter(
      (store) =>
        store.status === 'ACTIVE' &&
        store.departmentId === draft.departmentId,
    )
  }, [draft?.departmentId, selectedConfig, stores.data])

  const saveSection = useMutation({
    mutationFn: async () => {
      if (!selectedConfig || !draft) {
        throw new Error('No homepage section selected.')
      }

      return adminCatalogApi.updateDynamicHomepageSection(
        selectedConfig.id,
        {
          title: draft.title.trim(),
          enabled: draft.enabled,
          displayOrder: draft.displayOrder,
          limit: draft.limit,
          departmentId:
            selectedConfig.type === 'STORE_CATEGORY'
              ? draft.departmentId
              : null,
          productIds:
            selectedConfig.type === 'FEATURED_PRODUCTS' ||
            selectedConfig.type === 'SECOND_HAND_PRODUCTS'
              ? draft.productIds
              : [],
          storeIds:
            selectedConfig.type === 'STORE_CATEGORY'
              ? draft.storeIds
              : [],
        },
      )
    },
    onSuccess: async () => {
      setMessage('Homepage section saved successfully.')
      await invalidateHomepage()
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiClientError
          ? error.message
          : 'Unable to save homepage section.',
      )
    },
  })

  const removeSection = useMutation({
    mutationFn: (id: string) =>
      adminCatalogApi.removeDynamicHomepageSection(id),
    onSuccess: async () => {
      setSelectedId(null)
      setMessage('Homepage section removed.')
      await invalidateHomepage()
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiClientError
          ? error.message
          : 'Unable to remove homepage section.',
      )
    },
  })

  const moveSection = useMutation({
    mutationFn: async ({
      current,
      target,
    }: {
      current: HomepageSectionConfiguration
      target: HomepageSectionConfiguration
    }) => {
      await Promise.all([
        adminCatalogApi.updateDynamicHomepageSection(current.id, {
          displayOrder: target.displayOrder,
        }),
        adminCatalogApi.updateDynamicHomepageSection(target.id, {
          displayOrder: current.displayOrder,
        }),
      ])
    },
    onSuccess: invalidateHomepage,
  })

  async function invalidateHomepage() {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['admin', 'dynamic-homepage'],
      }),
      client.invalidateQueries({
        queryKey: ['homepage'],
      }),
      client.invalidateQueries({
        queryKey: ['dynamic-homepage'],
      }),
    ])
  }

  function addProduct(id: string) {
    if (!draft) return
    if (draft.productIds.includes(id)) return
    if (draft.productIds.length >= draft.limit) return

    setDraft({
      ...draft,
      productIds: [...draft.productIds, id],
    })
  }

  function removeProduct(id: string) {
    if (!draft) return

    setDraft({
      ...draft,
      productIds: draft.productIds.filter((value) => value !== id),
    })
  }

  function moveProduct(index: number, direction: -1 | 1) {
    if (!draft) return

    const target = index + direction

    if (target < 0 || target >= draft.productIds.length) return

    const copy = [...draft.productIds]
    ;[copy[index], copy[target]] = [
      copy[target]!,
      copy[index]!,
    ]

    setDraft({
      ...draft,
      productIds: copy,
    })
  }

  function toggleStore(id: string) {
    if (!draft) return

    if (draft.storeIds.includes(id)) {
      setDraft({
        ...draft,
        storeIds: draft.storeIds.filter((value) => value !== id),
      })
      return
    }

    if (draft.storeIds.length >= draft.limit) return

    setDraft({
      ...draft,
      storeIds: [...draft.storeIds, id],
    })
  }

  async function moveConfiguration(index: number, direction: -1 | 1) {
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= configurations.length) {
      return
    }

    const current = configurations[index]
    const target = configurations[targetIndex]

    if (!current || !target) return

    moveSection.mutate({ current, target })
  }

  if (homepage.isLoading) {
    return (
      <section className="space-y-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-gray-400">
          Loading homepage configuration…
        </div>
      </section>
    )
  }

  if (homepage.isError) {
    return (
      <section className="space-y-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-red-300">
          Unable to load the dynamic homepage configuration.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="text-amber-400 font-bold tracking-wider text-xs uppercase mb-2 block">
            Merchandising
          </span>

          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Homepage
          </h1>

          <p className="text-gray-400 text-lg">
            Control homepage sections, order, products and store departments.
          </p>
        </div>

        <button
          className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors"
          onClick={() => setIsCreateOpen(true)}
        >
          Add store section
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-8">
        <aside className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="px-2 mb-4">
            <h2 className="text-lg font-bold text-white">
              Homepage sections
            </h2>

            <p className="text-sm text-gray-400 mt-1">
              Sections are displayed from top to bottom.
            </p>
          </div>

          <div className="space-y-2">
            {configurations.map((config, index) => (
              <div
                key={config.id}
                className={`rounded-xl border transition-colors ${
                  selectedId === config.id
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-black/30 border-white/5'
                }`}
              >
                <button
                  className="w-full text-left p-4"
                  onClick={() => {
                    setSelectedId(config.id)
                    setMessage('')
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-white text-sm truncate">
                      {config.title}
                    </strong>

                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold ${
                        config.enabled
                          ? 'text-emerald-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {config.enabled ? 'Live' : 'Hidden'}
                    </span>
                  </div>

                  <span className="block text-xs text-gray-500 mt-1">
                    {typeLabels[config.type]}
                  </span>
                </button>

                <div className="flex border-t border-white/5">
                  <button
                    className="flex-1 py-2 text-gray-400 hover:text-white disabled:opacity-30"
                    disabled={index === 0 || moveSection.isPending}
                    onClick={() => void moveConfiguration(index, -1)}
                    aria-label={`Move ${config.title} up`}
                  >
                    ↑
                  </button>

                  <button
                    className="flex-1 py-2 text-gray-400 hover:text-white border-l border-white/5 disabled:opacity-30"
                    disabled={
                      index === configurations.length - 1 ||
                      moveSection.isPending
                    }
                    onClick={() => void moveConfiguration(index, 1)}
                    aria-label={`Move ${config.title} down`}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {selectedConfig && draft ? (
          <div className="space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div>
                  <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                    {typeLabels[selectedConfig.type]}
                  </span>

                  <h2 className="text-2xl font-bold text-white mt-1">
                    {draft.title}
                  </h2>
                </div>

                <label className="flex items-center gap-3 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        enabled: event.target.checked,
                      })
                    }
                  />
                  Show on homepage
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-300">
                    Section title
                  </span>

                  <input
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        title: event.target.value,
                      })
                    }
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-300">
                    Item limit
                  </span>

                  <input
                    type="number"
                    min={1}
                    max={48}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                    value={draft.limit}
                    onChange={(event) => {
                      const limit = Math.max(
                        1,
                        Math.min(48, Number(event.target.value) || 1),
                      )

                      setDraft({
                        ...draft,
                        limit,
                        productIds: draft.productIds.slice(0, limit),
                        storeIds: draft.storeIds.slice(0, limit),
                      })
                    }}
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-gray-300">
                    Display order
                  </span>

                  <input
                    type="number"
                    min={0}
                    max={999}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                    value={draft.displayOrder}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        displayOrder: Math.max(
                          0,
                          Number(event.target.value) || 0,
                        ),
                      })
                    }
                  />
                </label>
              </div>

              {selectedConfig.type === 'POPULAR_PRODUCTS' ? (
                <div className="mt-6 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-200">
                  Popular Products is fully automatic. Products are ranked
                  using completed orders, views and recency.
                </div>
              ) : null}

              {selectedConfig.type === 'STORE_CATEGORY' ? (
                <StoreSectionEditor
                  draft={draft}
                  setDraft={setDraft}
                  departments={departments.data ?? []}
                  stores={storeCandidates}
                  toggleStore={toggleStore}
                />
              ) : null}

              {selectedConfig.type === 'FEATURED_PRODUCTS' ||
              selectedConfig.type === 'SECOND_HAND_PRODUCTS' ? (
                <ProductSectionEditor
                  draft={draft}
                  search={search}
                  setSearch={setSearch}
                  candidates={productCandidates}
                  productMap={productMap}
                  loading={products.isLoading}
                  addProduct={addProduct}
                  removeProduct={removeProduct}
                  moveProduct={moveProduct}
                />
              ) : null}

              {message ? (
                <div
                  className={`mt-6 rounded-xl p-4 text-sm ${
                    message.includes('successfully') ||
                    message.includes('removed')
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                >
                  {message}
                </div>
              ) : null}

              <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 justify-between">
                {selectedConfig.type === 'STORE_CATEGORY' ? (
                  <button
                    className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                    disabled={removeSection.isPending}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Delete ${selectedConfig.title}?`,
                          description:
                            'This removes the store section from the homepage configuration.',
                          confirmLabel: 'Delete section',
                          tone: 'danger',
                        })
                      ) {
                        removeSection.mutate(selectedConfig.id)
                      }
                    }}
                  >
                    Delete section
                  </button>
                ) : (
                  <span />
                )}

                <button
                  className="px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
                  disabled={
                    saveSection.isPending ||
                    !draft.title.trim() ||
                    (selectedConfig.type === 'STORE_CATEGORY' &&
                      !draft.departmentId)
                  }
                  onClick={async () => {
                    if (
                      await confirm({
                        title: `Save ${draft.title}?`,
                        description:
                          'These changes will affect the public homepage.',
                        confirmLabel: 'Save section',
                      })
                    ) {
                      saveSection.mutate()
                    }
                  }}
                >
                  {saveSection.isPending
                    ? 'Saving…'
                    : 'Publish changes'}
                </button>
              </div>
            </div>

            <PublishedPreview section={publishedSection} />
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center text-gray-400">
            Select a homepage section.
          </div>
        )}
      </div>

      {isCreateOpen ? (
        <CreateStoreSectionModal
          departments={departments.data ?? []}
          existing={configurations}
          onClose={() => setIsCreateOpen(false)}
          onCreated={async (id) => {
            setIsCreateOpen(false)
            setSelectedId(id)
            await invalidateHomepage()
          }}
        />
      ) : null}
    </section>
  )
}

function ProductSectionEditor({
  draft,
  search,
  setSearch,
  candidates,
  productMap,
  loading,
  addProduct,
  removeProduct,
  moveProduct,
}: {
  draft: EditableSection
  search: string
  setSearch: (value: string) => void
  candidates: ProductSummary[]
  productMap: Map<string, ProductSummary>
  loading: boolean
  addProduct: (id: string) => void
  removeProduct: (id: string) => void
  moveProduct: (index: number, direction: -1 | 1) => void
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <div className="bg-black/20 border border-white/10 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white">
            Manual selection
          </h3>

          <p className="text-sm text-gray-400 mt-1">
            {draft.productIds.length
              ? `${draft.productIds.length} of ${draft.limit} selected. Manual mode shows exactly these eligible products.`
              : 'No manual products selected. This section uses automatic fallback.'}
          </p>
        </div>

        <div className="space-y-3">
          {draft.productIds.map((id, index) => {
            const product = productMap.get(id)

            return (
              <div
                key={id}
                className="flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl p-3"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>

                <div className="w-12 h-12 bg-black/60 rounded-lg overflow-hidden flex items-center justify-center">
                  {product?.primaryImage ? (
                    <img
                      src={product.primaryImage.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PackageIcon />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <strong className="text-sm text-white block truncate">
                    {product?.title ?? 'Selected product'}
                  </strong>
                  <span className="text-xs text-gray-500 block truncate">
                    {product?.category.name ?? id}
                  </span>
                </div>

                <div className="flex gap-1">
                  <button
                    disabled={index === 0}
                    className="w-8 h-8 rounded-lg bg-white/5 text-white disabled:opacity-30"
                    onClick={() => moveProduct(index, -1)}
                  >
                    ↑
                  </button>

                  <button
                    disabled={index === draft.productIds.length - 1}
                    className="w-8 h-8 rounded-lg bg-white/5 text-white disabled:opacity-30"
                    onClick={() => moveProduct(index, 1)}
                  >
                    ↓
                  </button>

                  <button
                    className="px-2 h-8 rounded-lg bg-red-500/10 text-red-400"
                    onClick={() => removeProduct(id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}

          {!draft.productIds.length ? (
            <div className="p-8 text-center border border-dashed border-white/10 rounded-xl text-gray-500">
              Automatic selection
            </div>
          ) : null}
        </div>
      </div>

      <div className="bg-black/20 border border-white/10 rounded-xl p-5">
        <h3 className="text-lg font-bold text-white">
          Find products
        </h3>

        <div className="relative mt-4 mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <SearchIcon />
          </span>

          <input
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white"
            placeholder="Search products..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto space-y-2">
          {candidates.map((product) => {
            const selected = draft.productIds.includes(product.id)
            const full = draft.productIds.length >= draft.limit

            return (
              <button
                key={product.id}
                className="w-full text-left flex items-center gap-3 bg-black/40 border border-white/5 rounded-xl p-3 disabled:opacity-50"
                disabled={selected || full}
                onClick={() => addProduct(product.id)}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/60 flex items-center justify-center">
                  {product.primaryImage ? (
                    <img
                      src={product.primaryImage.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PackageIcon />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <strong className="text-white block truncate text-sm">
                    {product.title}
                  </strong>
                  <span className="text-xs text-gray-500">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                </div>

                <span className="text-xs text-amber-400">
                  {selected ? 'Selected' : 'Add'}
                </span>
              </button>
            )
          })}

          {!loading && !candidates.length ? (
            <div className="p-8 text-center text-gray-500">
              No eligible products found.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function StoreSectionEditor({
  draft,
  setDraft,
  departments,
  stores,
  toggleStore,
}: {
  draft: EditableSection
  setDraft: (value: EditableSection) => void
  departments: Awaited<ReturnType<typeof storesApi.adminDepartments>>
  stores: Awaited<ReturnType<typeof storesApi.adminList>>
  toggleStore: (id: string) => void
}) {
  return (
    <div className="mt-8 space-y-6">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-gray-300">
          Store department
        </span>

        <select
          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
          value={draft.departmentId ?? ''}
          onChange={(event) =>
            setDraft({
              ...draft,
              departmentId: event.target.value || null,
              storeIds: [],
            })
          }
        >
          <option value="">Select department</option>

          {departments
            .filter((department) => department.isActive)
            .map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
        </select>
      </label>

      {draft.departmentId ? (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">
              Store selection
            </h3>

            <p className="text-sm text-gray-400 mt-1">
              {draft.storeIds.length
                ? `${draft.storeIds.length} stores selected manually.`
                : 'No stores selected. Stores will be ranked automatically using completed orders and available products.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stores.map((store) => {
              const selected = draft.storeIds.includes(store.id)
              const full =
                draft.storeIds.length >= draft.limit && !selected

              return (
                <button
                  type="button"
                  key={store.id}
                  disabled={full}
                  onClick={() => toggleStore(store.id)}
                  className={`text-left rounded-xl border p-4 transition-colors disabled:opacity-40 ${
                    selected
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-black/30 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-white truncate">
                      {store.name}
                    </strong>

                    <span className="text-xs text-amber-400">
                      {selected ? 'Selected' : 'Select'}
                    </span>
                  </div>

                  <span className="text-xs text-gray-500 block mt-1">
                    {store.campusLocation ?? 'Campus store'}
                  </span>
                </button>
              )
            })}
          </div>

          {!stores.length ? (
            <div className="mt-3 p-6 border border-dashed border-white/10 rounded-xl text-center text-gray-500">
              No active stores are assigned to this department yet.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PublishedPreview({
  section,
}: {
  section: DynamicHomepageSection | undefined
}) {
  if (!section) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-gray-500">
        This section is currently hidden or has no eligible content.
      </div>
    )
  }

  if (section.type === 'STORE_CATEGORY') {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
          Published preview
        </span>

        <h2 className="text-2xl font-bold text-white mt-1 mb-6">
          {section.title}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {section.stores.map((store) => (
            <div
              key={store.id}
              className="bg-black/30 border border-white/10 rounded-xl overflow-hidden"
            >
              <div className="aspect-[16/7] bg-black/40 overflow-hidden">
                {store.bannerUrl || store.logoUrl ? (
                  <img
                    src={store.bannerUrl ?? store.logoUrl ?? ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>

              <div className="p-4">
                <strong className="text-white block">
                  {store.name}
                </strong>

                <span className="text-xs text-gray-500 block mt-1">
                  {store.productCount} available products
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
        Published preview
      </span>

      <h2 className="text-2xl font-bold text-white mt-1 mb-6">
        {section.title}
      </h2>

      <ProductGrid
        products={section.products}
        emptyMessage="No eligible products are currently available."
      />
    </div>
  )
}

function CreateStoreSectionModal({
  departments,
  existing,
  onClose,
  onCreated,
}: {
  departments: Awaited<ReturnType<typeof storesApi.adminDepartments>>
  existing: HomepageSectionConfiguration[]
  onClose: () => void
  onCreated: (id: string) => Promise<void>
}) {
  const [departmentId, setDepartmentId] = useState('')
  const [title, setTitle] = useState('')
  const [limit, setLimit] = useState(8)
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () =>
      adminCatalogApi.createDynamicHomepageSection({
        type: 'STORE_CATEGORY',
        title: title.trim(),
        enabled: true,
        displayOrder:
          Math.max(
            0,
            ...existing.map((section) => section.displayOrder),
          ) + 1,
        limit,
        departmentId,
        productIds: [],
        storeIds: [],
      }),
    onSuccess: async (result) => {
      await onCreated(result.id)
    },
    onError: (value) => {
      setError(
        value instanceof ApiClientError
          ? value.message
          : 'Unable to create homepage section.',
      )
    },
  })

  const availableDepartments = departments.filter(
    (department) =>
      department.isActive &&
      !existing.some(
        (section) =>
          section.type === 'STORE_CATEGORY' &&
          section.departmentId === department.id,
      ),
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-gray-950 border border-white/10 rounded-2xl shadow-2xl p-6">
        <h2 className="text-2xl font-bold text-white">
          Add store section
        </h2>

        <p className="text-sm text-gray-400 mt-2">
          Create a homepage section for one Store Department.
        </p>

        <div className="space-y-4 mt-6">
          <label className="block space-y-2">
            <span className="text-sm text-gray-300">
              Department
            </span>

            <select
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
              value={departmentId}
              onChange={(event) => {
                const id = event.target.value
                const department = departments.find(
                  (item) => item.id === id,
                )

                setDepartmentId(id)

                if (department && !title.trim()) {
                  setTitle(department.name)
                }
              }}
            >
              <option value="">Select department</option>

              {availableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-gray-300">
              Homepage title
            </span>

            <input
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Section title"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-gray-300">
              Store limit
            </span>

            <input
              type="number"
              min={1}
              max={48}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
              value={limit}
              onChange={(event) =>
                setLimit(
                  Math.max(
                    1,
                    Math.min(48, Number(event.target.value) || 1),
                  ),
                )
              }
            />
          </label>
        </div>

        {error ? (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex gap-2">
            <AlertIcon />
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 rounded-xl bg-white/5 text-gray-300"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
            disabled={
              create.isPending ||
              !departmentId ||
              title.trim().length < 2
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Create section'}
          </button>
        </div>
      </div>
    </div>
  )
}
