import type { CreateSecondHandListingInput, SecondHandCondition } from '@campusbaza/contracts'
import { useMutation, useQuery } from '@tanstack/react-query'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertIcon, PackageIcon } from '../../../components/ui/icons'
import { ApiClientError } from '../../../lib/api-client'
import { useAuthStore } from '../../auth/store/use-auth-store'
import { listingsApi } from '../api/listings.api'

const conditionOptions: Array<{ value: SecondHandCondition; label: string }> = [
  { value: 'LIKE_NEW', label: 'Like new' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'USED', label: 'Used' },
  { value: 'OPEN_BOX', label: 'Open box' },
]

interface ListingFormState {
  title: string
  categoryId: string
  description: string
  price: string
  originalPrice: string
  condition: SecondHandCondition
  productAge: string
  stock: string
  pickupLocation: string
  reasonForSelling: string
  additionalDetails: string
  tags: string
}

const initialForm: ListingFormState = {
  title: '',
  categoryId: '',
  description: '',
  price: '',
  originalPrice: '',
  condition: 'GOOD',
  productAge: '',
  stock: '1',
  pickupLocation: '',
  reasonForSelling: '',
  additionalDetails: '',
  tags: '',
}

export function ListingFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [form, setForm] = useState<ListingFormState>(initialForm)
  const [files, setFiles] = useState<File[]>([])
  const [keepImageIds, setKeepImageIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const categories = useQuery({ queryKey: ['categories'], queryFn: listingsApi.categories })
  const listing = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsApi.get(id!),
    enabled: editing,
  })

  useEffect(() => {
    const value = listing.data
    if (!value) return
    setForm({
      title: value.title,
      categoryId: value.category.id,
      description: value.description,
      price: String(value.price),
      originalPrice: value.originalPrice === null ? '' : String(value.originalPrice),
      condition: value.condition === 'NEW' ? 'GOOD' : value.condition,
      productAge: value.productAge ?? '',
      stock: String(Math.max(1, value.stock)),
      pickupLocation: value.pickupLocation ?? '',
      reasonForSelling: value.reasonForSelling ?? '',
      additionalDetails: value.additionalDetails ?? '',
      tags: value.tags.join(', '),
    })
    setKeepImageIds(value.images.map((image) => image.id))
  }, [listing.data])

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  )
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews])

  const mutation = useMutation({
    mutationFn: async () => {
      const totalImages = keepImageIds.length + files.length
      if (totalImages < 1 || totalImages > 8) {
        throw new Error('Keep or upload between 1 and 8 product images.')
      }
      const uploaded = files.length ? await listingsApi.uploadImages(files) : []
      const input: CreateSecondHandListingInput = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        price: Number(form.price),
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        condition: form.condition,
        productAge: form.productAge.trim() || null,
        stock: Number(form.stock),
        pickupLocation: form.pickupLocation.trim(),
        reasonForSelling: form.reasonForSelling.trim() || null,
        additionalDetails: form.additionalDetails.trim() || null,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        imageUploadIds: uploaded.map((image) => image.id),
        keepImageIds,
      }
      try {
        return editing ? await listingsApi.update(id!, input) : await listingsApi.create(input)
      } catch (error) {
        await Promise.allSettled(uploaded.map((image) => listingsApi.removeUpload(image.id)))
        throw error
      }
    },
    onSuccess: (value) => navigate(`/account/listings/${value.id}`),
    onError: (error) =>
      setMessage(
        error instanceof ApiClientError || error instanceof Error
          ? error.message
          : 'Unable to submit this listing.',
      ),
  })

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    if (keepImageIds.length + selected.length > 8) {
      setMessage('A listing can contain at most 8 images.')
      event.target.value = ''
      return
    }
    setFiles(selected)
    setMessage('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!form.title.trim() || !form.categoryId || form.description.trim().length < 10) {
      setMessage('Complete the title, category and description.')
      return
    }
    if (Number(form.price) <= 0 || Number(form.stock) < 1) {
      setMessage('Enter a valid price and quantity.')
      return
    }
    mutation.mutate()
  }

  const existingImages = listing.data?.images ?? []
  const allowedToEdit =
    !listing.data ||
    ['DRAFT', 'PENDING_APPROVAL', 'CHANGES_REQUESTED', 'REJECTED', 'APPROVED'].includes(
      listing.data.status,
    )

  return (
    <section className="listing-form-page">
      <div className="page-heading">
        <div>
          <span className="section-kicker">Second-hand marketplace</span>
          <h1>{editing ? 'Edit and resubmit' : 'Sell an item'}</h1>
          <p>
            User products are always marked second-hand and remain private until an administrator
            approves them.
          </p>
        </div>
      </div>

      {!user?.profileCompleted ? (
        <div className="form-alert listing-profile-warning">
          <AlertIcon />
          <div>
            <strong>Complete your profile first</strong>
            <p>Your name and department are required before a listing can be submitted.</p>
          </div>
          <Link className="button button-outline" to="/account/profile">
            Complete profile
          </Link>
        </div>
      ) : null}

      {editing && listing.isLoading ? <div className="content-card">Loading listing…</div> : null}
      {editing && listing.isError ? (
        <div className="form-alert">This listing could not be loaded.</div>
      ) : null}
      {editing && listing.data && !allowedToEdit ? (
        <div className="form-alert">This listing cannot be edited in its current status.</div>
      ) : null}

      {(!editing || listing.data) && allowedToEdit ? (
        <form className="content-card listing-form" onSubmit={submit}>
          <div className="listing-form-section">
            <div className="listing-form-section-title">
              <PackageIcon />
              <div>
                <h2>Product information</h2>
                <p>Use clear, honest information so moderation and pickup are easier.</p>
              </div>
            </div>
            <div className="form-grid two-columns">
              <label>
                Product title
                <input
                  required
                  minLength={3}
                  maxLength={140}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  required
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  <option value="">Choose category</option>
                  {(categories.data ?? [])
                    .filter((category) => category.isActive)
                    .map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="wide-field">
                Description
                <textarea
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={6}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </label>
              <label>
                Selling price (₹)
                <input
                  required
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </label>
              <label>
                Original price (₹), optional
                <input
                  type="number"
                  min="1"
                  value={form.originalPrice}
                  onChange={(event) => setForm({ ...form, originalPrice: event.target.value })}
                />
              </label>
              <label>
                Condition
                <select
                  value={form.condition}
                  onChange={(event) =>
                    setForm({ ...form, condition: event.target.value as SecondHandCondition })
                  }
                >
                  {conditionOptions.map((condition) => (
                    <option value={condition.value} key={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Product age, optional
                <input
                  placeholder="Example: 8 months"
                  maxLength={80}
                  value={form.productAge}
                  onChange={(event) => setForm({ ...form, productAge: event.target.value })}
                />
              </label>
              <label>
                Quantity
                <input
                  required
                  type="number"
                  min="1"
                  max="20"
                  value={form.stock}
                  onChange={(event) => setForm({ ...form, stock: event.target.value })}
                />
              </label>
              <label>
                Campus pickup location
                <input
                  required
                  minLength={2}
                  maxLength={160}
                  value={form.pickupLocation}
                  onChange={(event) => setForm({ ...form, pickupLocation: event.target.value })}
                />
              </label>
              <label className="wide-field">
                Reason for selling, optional
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.reasonForSelling}
                  onChange={(event) => setForm({ ...form, reasonForSelling: event.target.value })}
                />
              </label>
              <label className="wide-field">
                Additional details, optional
                <textarea
                  rows={4}
                  maxLength={1500}
                  value={form.additionalDetails}
                  onChange={(event) => setForm({ ...form, additionalDetails: event.target.value })}
                />
              </label>
              <label className="wide-field">
                Search tags, comma separated
                <input
                  value={form.tags}
                  onChange={(event) => setForm({ ...form, tags: event.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="listing-form-section image-upload-section">
            <div>
              <h2>Product images</h2>
              <p>Upload 1–8 JPEG, PNG or WebP images. Each file can be up to 5 MB.</p>
            </div>
            {existingImages.length ? (
              <div className="listing-image-grid">
                {existingImages.map((image) => {
                  const kept = keepImageIds.includes(image.id)
                  return (
                    <button
                      type="button"
                      className={`listing-image-tile ${kept ? '' : 'removed'}`}
                      key={image.id}
                      onClick={() =>
                        setKeepImageIds((current) =>
                          current.includes(image.id)
                            ? current.filter((item) => item !== image.id)
                            : [...current, image.id],
                        )
                      }
                    >
                      <img src={image.url} alt={image.altText || listing.data?.title} />
                      <span>{kept ? 'Keep image' : 'Remove image'}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
            {previews.length ? (
              <div className="listing-image-grid">
                {previews.map((preview) => (
                  <div className="listing-image-tile new-image" key={preview.url}>
                    <img src={preview.url} alt={preview.file.name} />
                    <span>New upload</span>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="file-drop-field">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={selectFiles}
              />
              <strong>Choose product images</strong>
              <span>Images upload securely when you submit the form.</span>
            </label>
          </div>

          {message ? <div className="form-alert">{message}</div> : null}
          <div className="listing-form-actions">
            <Link className="button button-outline" to="/account/listings">
              Cancel
            </Link>
            <button
              className="button button-primary"
              disabled={mutation.isPending || !user?.profileCompleted}
            >
              {mutation.isPending
                ? files.length
                  ? 'Uploading and submitting…'
                  : 'Submitting…'
                : editing
                  ? 'Save and resubmit'
                  : 'Submit for approval'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
