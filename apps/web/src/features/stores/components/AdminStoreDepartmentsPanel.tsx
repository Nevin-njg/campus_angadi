import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
import {
  storesApi,
  type StoreDepartment,
  type StoreDepartmentCardTheme,
} from '../api/stores.api'

interface DepartmentForm {
  name: string
  description: string
  cardTheme: StoreDepartmentCardTheme
  customBackgroundStart: string
  customBackgroundEnd: string
  customStickers: string[]
  displayOrder: string
  isActive: boolean
}

const initialForm: DepartmentForm = {
  name: '',
  description: '',
  cardTheme: 'GENERAL',
  customBackgroundStart: '#F5EDFF',
  customBackgroundEnd: '#E9DCFF',
  customStickers: ['🎨', '✨', '⭐', '🛍️', '💫'],
  displayOrder: '0',
  isActive: true,
}

const CARD_THEME_OPTIONS: Array<{
  value: StoreDepartmentCardTheme
  label: string
  icon: string
  description: string
}> = [
  {
    value: 'FOOD',
    label: 'Food',
    icon: '🍔',
    description: 'Meals, snacks & drinks',
  },
  {
    value: 'SPORTS',
    label: 'Sports',
    icon: '⚽',
    description: 'Gear, fitness & games',
  },
  {
    value: 'STATIONERY',
    label: 'Stationery',
    icon: '✏️',
    description: 'Books, notes & supplies',
  },
  {
    value: 'ELECTRONICS',
    label: 'Electronics',
    icon: '🎧',
    description: 'Devices & accessories',
  },
  {
    value: 'GROCERY',
    label: 'Grocery',
    icon: '🛒',
    description: 'Daily campus essentials',
  },
  {
    value: 'FASHION',
    label: 'Fashion',
    icon: '👕',
    description: 'Clothing & accessories',
  },
  {
    value: 'CUSTOM',
    label: 'Custom',
    icon: '🎨',
    description: 'Choose your own card design',
  },
  {
    value: 'GENERAL',
    label: 'General',
    icon: '✨',
    description: 'Flexible marketplace style',
  },
]

export function AdminStoreDepartmentsPanel() {
  const queryClient = useQueryClient()
  const confirm = useConfirmation()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] =
    useState<StoreDepartment | null>(null)
  const [form, setForm] = useState<DepartmentForm>(initialForm)
  const [formError, setFormError] = useState<string | null>(null)

  const departmentsQuery = useQuery({
    queryKey: ['admin', 'store-departments'],
    queryFn: storesApi.adminDepartments,
  })

  const createDepartment = useMutation({
    mutationFn: storesApi.createDepartment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'store-departments'],
      })
      closeForm()
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The department could not be created.',
      )
    },
  })

  const updateDepartment = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: Parameters<typeof storesApi.updateDepartment>[1]
    }) => storesApi.updateDepartment(id, body),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'store-departments'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'stores'],
        }),
      ])
      closeForm()
    },

    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The department could not be updated.',
      )
    },
  })

  const removeDepartment = useMutation({
    mutationFn: storesApi.removeDepartment,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'store-departments'],
      })
    },
  })

  function openCreate() {
    setEditingDepartment(null)
    setForm(initialForm)
    setFormError(null)
    setIsFormOpen(true)
  }

  function openEdit(department: StoreDepartment) {
    setEditingDepartment(department)
    setForm({
      name: department.name,
      description: department.description ?? '',
      cardTheme: department.cardTheme ?? 'GENERAL',
      customBackgroundStart:
        department.customBackgroundStart ?? '#F5EDFF',
      customBackgroundEnd:
        department.customBackgroundEnd ?? '#E9DCFF',
      customStickers: [
        ...(department.customStickers ?? []),
        '',
        '',
        '',
        '',
        '',
      ].slice(0, 5),
      displayOrder: String(department.displayOrder),
      isActive: department.isActive,
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  function closeForm() {
    if (createDepartment.isPending || updateDepartment.isPending) return

    setEditingDepartment(null)
    setForm(initialForm)
    setFormError(null)
    setIsFormOpen(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const name = form.name.trim()
    const displayOrder = Number(form.displayOrder)

    if (name.length < 2) {
      setFormError('Enter a department name.')
      return
    }

    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      setFormError('Display order must be zero or greater.')
      return
    }

    const body = {
      name,
      description: form.description.trim() || null,
      cardTheme: form.cardTheme,
      customBackgroundStart:
        form.cardTheme === 'CUSTOM'
          ? form.customBackgroundStart
          : null,
      customBackgroundEnd:
        form.cardTheme === 'CUSTOM'
          ? form.customBackgroundEnd
          : null,
      customStickers:
        form.cardTheme === 'CUSTOM'
          ? form.customStickers
              .map((sticker) => sticker.trim())
              .filter(Boolean)
          : [],
      displayOrder,
      isActive: form.isActive,
    }

    if (editingDepartment) {
      updateDepartment.mutate({
        id: editingDepartment.id,
        body,
      })
      return
    }

    createDepartment.mutate(body)
  }

  const departments = departmentsQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Store Departments</h2>
          <p className="mt-1 text-sm text-gray-400">
            Group stores into marketplace sections such as Food, Stationery,
            Electronics, or any department you create.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-black transition hover:bg-amber-400"
        >
          + Add department
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                {['Department', 'Status', 'Order', 'Actions'].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {departments.map((department) => (
                <tr
                  key={department.id}
                  className="transition hover:bg-white/[0.03]"
                >
                  <td className="px-6 py-5">
                    <strong className="block text-white">
                      {department.name}
                    </strong>

                    <small className="text-gray-500">
                      {department.description || department.slug}
                    </small>
                  </td>

                  <td className="px-6 py-5">
                    <button
                      type="button"
                      onClick={() =>
                        updateDepartment.mutate({
                          id: department.id,
                          body: {
                            isActive: !department.isActive,
                          },
                        })
                      }
                      disabled={updateDepartment.isPending}
                      className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${
                        department.isActive
                          ? 'border-green-500/20 bg-green-500/15 text-green-400'
                          : 'border-gray-500/20 bg-gray-500/15 text-gray-400'
                      }`}
                    >
                      {department.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>

                  <td className="px-6 py-5 font-medium text-gray-300">
                    {department.displayOrder}
                  </td>

                  <td className="px-6 py-5">
                    <button
                      type="button"
                      onClick={() => openEdit(department)}
                      className="mr-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/10"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={removeDepartment.isPending}
                      onClick={async () => {
                        const approved = await confirm({
                          title: `Delete ${department.name}?`,
                          description:
                            'This department can only be deleted when no stores are assigned to it.',
                          confirmLabel: 'Delete department',
                          tone: 'danger',
                        })

                        if (approved) {
                          removeDepartment.mutate(department.id)
                        }
                      }}
                      className="rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {departmentsQuery.isLoading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-14 text-center text-gray-400"
                  >
                    Loading departments…
                  </td>
                </tr>
              )}

              {!departmentsQuery.isLoading && departments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center">
                    <h3 className="font-bold text-white">
                      No store departments yet
                    </h3>
                    <p className="mt-2 text-sm text-gray-400">
                      Create your first department to begin grouping stores.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {removeDepartment.isError && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {removeDepartment.error instanceof Error
            ? removeDepartment.error.message
            : 'The department could not be deleted.'}
        </p>
      )}

      {isFormOpen &&
        createPortal(
          <div
          className="fixed inset-0 z-[100] flex h-[100dvh] items-center justify-center overflow-hidden bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Store classification
                </p>

                <h2 className="mt-1 text-2xl font-bold text-white">
                  {editingDepartment
                    ? 'Edit department'
                    : 'Create department'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-white/10 px-3 py-2 text-gray-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={submit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-200">
                  Department name *
                </span>

                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Example: Food & Restaurants"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-200">
                  Description
                </span>

                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Optional description"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                />
              </label>

              <div className="space-y-3">
                <div>
                  <span className="text-sm font-semibold text-gray-200">
                    Card style
                  </span>
                  <p className="mt-1 text-xs text-gray-500">
                    Controls the visual theme and background stickers used on
                    the homepage department card.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {CARD_THEME_OPTIONS.map((option) => {
                    const selected = form.cardTheme === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm({
                            ...form,
                            cardTheme: option.value,
                          })
                        }
                        className={`relative overflow-hidden rounded-xl border p-4 text-left transition ${
                          selected
                            ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-500/20'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className="absolute -right-2 -top-3 text-5xl opacity-10">
                          {option.icon}
                        </span>

                        <span className="relative block text-2xl">
                          {option.icon}
                        </span>

                        <strong className="relative mt-2 block text-sm text-white">
                          {option.label}
                        </strong>

                        <small className="relative mt-1 block text-xs leading-4 text-gray-500">
                          {option.description}
                        </small>

                        {selected ? (
                          <span className="relative mt-3 inline-flex rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
                            Selected
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              {form.cardTheme === 'CUSTOM' ? (
                <div className="space-y-5 rounded-2xl border border-purple-400/20 bg-purple-500/[0.06] p-5">
                  <div>
                    <h3 className="font-bold text-white">
                      Custom card design
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                      Choose the background and decorative stickers for this
                      department.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="block text-xs font-semibold text-gray-300">
                        Background start
                      </span>

                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2">
                        <input
                          type="color"
                          value={form.customBackgroundStart}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              customBackgroundStart: event.target.value,
                            })
                          }
                          className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
                        />

                        <input
                          value={form.customBackgroundStart}
                          maxLength={7}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              customBackgroundStart: event.target.value,
                            })
                          }
                          className="min-w-0 flex-1 bg-transparent text-sm font-medium uppercase text-white outline-none"
                        />
                      </div>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-xs font-semibold text-gray-300">
                        Background end
                      </span>

                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2">
                        <input
                          type="color"
                          value={form.customBackgroundEnd}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              customBackgroundEnd: event.target.value,
                            })
                          }
                          className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
                        />

                        <input
                          value={form.customBackgroundEnd}
                          maxLength={7}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              customBackgroundEnd: event.target.value,
                            })
                          }
                          className="min-w-0 flex-1 bg-transparent text-sm font-medium uppercase text-white outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-semibold text-gray-200">
                        Background stickers
                      </span>
                      <p className="mt-1 text-xs text-gray-500">
                        Add up to five emoji or short symbols.
                      </p>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {form.customStickers.map((sticker, index) => (
                        <input
                          key={index}
                          value={sticker}
                          maxLength={16}
                          aria-label={`Sticker ${index + 1}`}
                          onChange={(event) => {
                            const customStickers = [
                              ...form.customStickers,
                            ]

                            customStickers[index] = event.target.value

                            setForm({
                              ...form,
                              customStickers,
                            })
                          }}
                          placeholder="✨"
                          className="min-w-0 rounded-xl border border-white/10 bg-black/20 px-2 py-3 text-center text-xl text-white outline-none focus:border-purple-400/60 focus:ring-2 focus:ring-purple-500/20"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Live preview
                    </span>

                    <div
                      className="relative min-h-[190px] overflow-hidden rounded-2xl border border-black/10 p-5 text-neutral-900 shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${form.customBackgroundStart}, ${form.customBackgroundEnd})`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute inset-x-4 top-3 flex items-start justify-end gap-3 opacity-20"
                        aria-hidden="true"
                      >
                        {form.customStickers
                          .filter((sticker) => sticker.trim())
                          .map((sticker, index) => (
                            <span
                              key={`${sticker}-${index}`}
                              className={`${
                                index === 0
                                  ? 'text-5xl'
                                  : index === 1
                                    ? 'mt-9 text-3xl'
                                    : index === 2
                                      ? 'text-2xl'
                                      : 'mt-5 text-xl'
                              }`}
                            >
                              {sticker}
                            </span>
                          ))}
                      </div>

                      <div className="relative z-10 flex min-h-[150px] flex-col">
                        <h3 className="mt-auto text-xl font-black tracking-tight">
                          {form.name.trim() || 'Custom department'}
                        </h3>

                        <p className="mt-1 max-w-[80%] text-sm opacity-65">
                          {form.description.trim() ||
                            'Explore this department'}
                        </p>

                        <span className="mt-4 text-sm font-bold">
                          View stores →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-200">
                  Display order
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.displayOrder}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      displayOrder: event.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <strong className="block text-sm text-white">
                    Active department
                  </strong>

                  <span className="text-xs text-gray-500">
                    Disabled departments will not be available for marketplace
                    display.
                  </span>
                </div>

                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      isActive: event.target.checked,
                    })
                  }
                  className="h-5 w-5 accent-amber-500"
                />
              </label>

              {formError && (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {formError}
                </p>
              )}

              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-white/10 bg-neutral-950 px-6 py-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-white/10 px-5 py-3 font-semibold text-gray-300 hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    createDepartment.isPending ||
                    updateDepartment.isPending
                  }
                  className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {createDepartment.isPending ||
                  updateDepartment.isPending
                    ? 'Saving…'
                    : 'Save department'}
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body,
        )}
    </div>
  )
}
