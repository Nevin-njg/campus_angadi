import type { CreateReportInput, ReportType } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { reportsApi } from '../api/reports.api'
import { useConfirmation } from '../../../components/feedback/ConfirmationProvider'
export function MyReportsPage() {
  const [params] = useSearchParams()
  const c = useQueryClient()
  const confirm = useConfirmation()
  const [form, setForm] = useState<CreateReportInput>({
    targetType: params.get('targetType') === 'USER' ? 'USER' : 'PRODUCT',
    targetId: params.get('targetId') ?? '',
    type: 'OTHER',
    description: '',
  })
  const [msg, setMsg] = useState('')
  const q = useQuery({
    queryKey: ['reports', 'mine'],
    queryFn: () => reportsApi.list({ page: 1, limit: 30 }),
  })
  const m = useMutation({
    mutationFn: reportsApi.create,
    onSuccess: async () => {
      setMsg('Report submitted.')
      setForm({ ...form, description: '' })
      await c.invalidateQueries({ queryKey: ['reports', 'mine'] })
    },
    onError: (e) => setMsg(e.message),
  })
  async function submit(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    if (await confirm({ title: 'Submit this safety report?', description: 'Campus Angadi administrators will receive the report and its description for review.', confirmLabel: 'Submit report' })) m.mutate(form)
  }
  return (
    <section>
      <div className="page-title-row">
        <div>
          <span className="section-kicker">Trust and safety</span>
          <h1>My reports</h1>
          <p>Report a product or seller and track the review outcome.</p>
        </div>
      </div>
      <form className="admin-card admin-form report-submit" onSubmit={submit}>
        <label>
          Target type
          <select
            value={form.targetType}
            onChange={(e) =>
              setForm({ ...form, targetType: e.target.value as CreateReportInput['targetType'] })
            }
          >
            <option>PRODUCT</option>
            <option>USER</option>
          </select>
        </label>
        <label>
          Product or user ID
          <input
            required
            value={form.targetId}
            onChange={(e) => setForm({ ...form, targetId: e.target.value })}
          />
        </label>
        <label>
          Reason
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ReportType })}
          >
            <option>MISLEADING_PRODUCT</option>
            <option>PROHIBITED_ITEM</option>
            <option>FRAUD</option>
            <option>DUPLICATE_LISTING</option>
            <option>INAPPROPRIATE_CONTENT</option>
            <option>INCORRECT_CONDITION</option>
            <option>SELLER_ISSUE</option>
            <option>OTHER</option>
          </select>
        </label>
        <label className="wide-field">
          Details
          <textarea
            required
            minLength={10}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <button className="button button-primary">Submit report</button>
        {msg ? <p className="form-message">{msg}</p> : null}
      </form>
      <div className="report-list account-report-list">
        {q.data?.items.map((x) => (
          <article className="admin-card" key={x.id}>
            <div className="section-heading">
              <h2>{x.type.replaceAll('_', ' ')}</h2>
              <span className="status-pill">{x.status}</span>
            </div>
            <p>{x.description}</p>
            <small>
              Target: {x.targetLabel} · {new Date(x.createdAt).toLocaleDateString()}
            </small>
            {x.resolution ? (
              <p className="report-resolution">
                <strong>Outcome:</strong> {x.resolution}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
