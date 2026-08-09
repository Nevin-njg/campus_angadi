import type { CreateReportInput, ReportType } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { reportsApi } from '../api/reports.api'
import { useConfirmation } from '../../../components/feedback/confirmation-context'
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
    if (
      await confirm({
        title: 'Submit this safety report?',
        description:
          'Campus Angadi administrators will receive the report and its description for review.',
        confirmLabel: 'Submit report',
      })
    )
      m.mutate(form)
  }
  return (
    <section>
      <div className="page-title-row">
        <div>
          <h1>Reports</h1>
          <p>Report a product or seller and check its status.</p>
        </div>
      </div>
      <form
        className="student-form-panel admin-form report-submit"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Target type
          <select
            value={form.targetType}
            onChange={(e) =>
              setForm({ ...form, targetType: e.target.value as CreateReportInput['targetType'] })
            }
          >
            <option value="PRODUCT">Product</option>
            <option value="USER">Seller or user</option>
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
            <option value="MISLEADING_PRODUCT">Misleading product information</option>
            <option value="PROHIBITED_ITEM">Prohibited item</option>
            <option value="FRAUD">Fraud or scam</option>
            <option value="DUPLICATE_LISTING">Duplicate listing</option>
            <option value="INAPPROPRIATE_CONTENT">Inappropriate content</option>
            <option value="INCORRECT_CONDITION">Incorrect item condition</option>
            <option value="SELLER_ISSUE">Seller issue</option>
            <option value="OTHER">Other</option>
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
          <article className="student-report-row" key={x.id}>
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
