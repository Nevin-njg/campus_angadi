import type { NotificationType, SendNotificationInput } from '@campusbaza/contracts'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { adminPlatformApi } from '../api/admin-platform.api'
import { BellIcon, SendIcon, AlertTriangleIcon } from '../../../components/ui/icons'

export function AdminNotificationsPage() {
  const [form, setForm] = useState<SendNotificationInput>({
    audience: 'ALL',
    type: 'SYSTEM',
    title: '',
    message: '',
    referenceType: null,
    referenceId: null,
  })
  const [msg, setMsg] = useState('')
  
  const m = useMutation({
    mutationFn: adminPlatformApi.sendNotification,
    onSuccess: (x) => setMsg(`Notification sent successfully to ${x.recipientCount} recipients.`),
    onError: (e) => setMsg(e.message),
  })
  
  function submit(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    m.mutate(form)
  }

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500 mt-1"
  const labelClass = "block text-sm font-medium text-gray-300"

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block flex items-center gap-2">
            <BellIcon className="w-4 h-4" /> Communication
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Send notification</h1>
          <p className="text-gray-400 text-lg">Send an in-app announcement to a user group or a specific account.</p>
        </div>
      </div>

      <form className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl relative overflow-hidden" onSubmit={submit}>
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <BellIcon className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className={labelClass}>
              Audience
              <select
                className={`${inputClass} appearance-none`}
                value={form.audience ?? 'ALL'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    audience: e.target.value as SendNotificationInput['audience'],
                    userId: null,
                  })
                }
              >
                <option value="ALL">All active users</option>
                <option value="USER">Users only</option>
                <option value="ADMIN">Administrators</option>
              </select>
            </label>
            
            <label className={labelClass}>
              Specific user ID (optional)
              <input
                className={inputClass}
                placeholder="Leave blank for group broadcast"
                value={form.userId ?? ''}
                onChange={(e) => setForm({ ...form, userId: e.target.value || null })}
              />
            </label>
          </div>

          <label className={labelClass}>
            Type
            <select
              className={`${inputClass} appearance-none`}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as NotificationType })}
            >
              <option value="SYSTEM">System Announcement</option>
              <option value="PRODUCT">Product Update</option>
              <option value="ORDER">Order Status</option>
              <option value="ACCOUNT">Account Notice</option>
              <option value="REPORT">Moderation Report</option>
            </select>
          </label>
          
          <div className="pt-6 mt-6 border-t border-white/10 space-y-6">
            <label className={labelClass}>
              Title
              <input
                className={inputClass}
                required
                minLength={2}
                placeholder="Brief, descriptive subject"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            
            <label className={labelClass}>
              Message
              <textarea
                className={`${inputClass} min-h-[150px] resize-y`}
                required
                minLength={2}
                placeholder="The main content of your notification..."
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
            </label>
          </div>

          {msg && (
            <div className={`mt-6 p-4 rounded-xl border text-sm font-medium flex items-center gap-2 ${
              m.isError 
                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {m.isError ? <AlertTriangleIcon className="w-5 h-5 shrink-0" /> : <BellIcon className="w-5 h-5 shrink-0" />}
              {msg}
            </div>
          )}

          <div className="pt-6 mt-6 border-t border-white/10 flex justify-end">
            <button 
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg" 
              disabled={m.isPending}
            >
              {m.isPending ? 'Sending...' : <><SendIcon className="w-5 h-5" /> Send notification</>}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
