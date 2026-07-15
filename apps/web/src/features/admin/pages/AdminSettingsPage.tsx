import type { PlatformSettings } from '@campusbaza/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { adminPlatformApi } from '../api/admin-platform.api'
import { LoadingSkeleton } from '../../../components/ui/LoadingSkeleton'
import { SettingsIcon, SaveIcon, AlertTriangleIcon, CheckCircleIcon } from '../../../components/ui/icons'

export function AdminSettingsPage() {
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: adminPlatformApi.settings })
  const [form, setForm] = useState<PlatformSettings | null>(null)
  const [locations, setLocations] = useState('')
  const [msg, setMsg] = useState('')
  const c = useQueryClient()
  
  useEffect(() => {
    if (q.data) {
      setForm(q.data)
      setLocations(q.data.defaultPickupLocations.join(', '))
    }
  }, [q.data])
  
  const m = useMutation({
    mutationFn: adminPlatformApi.updateSettings,
    onSuccess: async (x) => {
      setForm(x)
      setMsg('Settings saved successfully.')
      await c.invalidateQueries({ queryKey: ['admin', 'settings'] })
    },
    onError: (e) => setMsg(e.message),
  })
  
  function submit(e: FormEvent) {
    e.preventDefault()
    if (form)
      m.mutate({
        ...form,
        defaultPickupLocations: locations
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      })
  }

  const inputClass = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500 mt-1"
  const labelClass = "block text-sm font-medium text-gray-300"

  if (!form) return <LoadingSkeleton label="Loading settings" />
  
  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-indigo-400 font-bold tracking-wider text-xs uppercase mb-2 block flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> Platform configuration
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Settings</h1>
          <p className="text-gray-400 text-lg">Control branding, marketplace availability and operational defaults.</p>
        </div>
      </div>

      <form className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-xl" onSubmit={submit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Brand & Identity */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10">Brand & Identity</h2>
            
            <label className={labelClass}>
              Application name
              <input
                className={inputClass}
                required
                value={form.appName}
                onChange={(e) => setForm({ ...form, appName: e.target.value })}
              />
            </label>
            
            <label className={labelClass}>
              Brand mark
              <input
                className={inputClass}
                required
                value={form.brandMark}
                onChange={(e) => setForm({ ...form, brandMark: e.target.value })}
              />
            </label>
            
            <label className={labelClass}>
              Campus name
              <input
                className={inputClass}
                required
                value={form.campusDisplayName}
                onChange={(e) => setForm({ ...form, campusDisplayName: e.target.value })}
              />
            </label>
          </div>

          {/* Contact & Support */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10">Contact & Support</h2>
            
            <label className={labelClass}>
              Support email
              <input
                className={inputClass}
                type="email"
                placeholder="support@campusbaza.com"
                value={form.supportEmail ?? ''}
                onChange={(e) => setForm({ ...form, supportEmail: e.target.value || null })}
              />
            </label>
            
            <label className={labelClass}>
              Support phone
              <input
                className={inputClass}
                placeholder="+91 98765 43210"
                value={form.supportPhone ?? ''}
                onChange={(e) => setForm({ ...form, supportPhone: e.target.value || null })}
              />
            </label>
          </div>

          {/* Marketplace Rules */}
          <div className="space-y-6 md:col-span-2">
            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10 mt-4">Marketplace Rules</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className={labelClass}>
                Listing expiry days
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  required
                  value={form.listingExpirationDays}
                  onChange={(e) => setForm({ ...form, listingExpirationDays: Number(e.target.value) })}
                />
              </label>
              
              <label className={labelClass}>
                Max active listings per user
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  required
                  value={form.maxActiveListingsPerUser}
                  onChange={(e) => setForm({ ...form, maxActiveListingsPerUser: Number(e.target.value) })}
                />
              </label>
            </div>
            
            <label className={labelClass}>
              Pickup locations (comma separated)
              <input 
                className={inputClass}
                placeholder="Library, Main Gate, Hostel Block A..."
                value={locations} 
                onChange={(e) => setLocations(e.target.value)} 
              />
            </label>
            
            <div className="flex flex-col md:flex-row gap-4 mt-6">
              <label className="flex-1 flex items-center gap-3 text-white cursor-pointer p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/50"
                  checked={form.allowNewListings}
                  onChange={(e) => setForm({ ...form, allowNewListings: e.target.checked })}
                />
                <div>
                  <span className="font-medium block">Allow new listings</span>
                  <span className="text-xs text-gray-500 font-normal">Users can create new products</span>
                </div>
              </label>
              
              <label className="flex-1 flex items-center gap-3 text-white cursor-pointer p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/20 bg-black/40 text-indigo-500 focus:ring-indigo-500/50"
                  checked={form.allowOrders}
                  onChange={(e) => setForm({ ...form, allowOrders: e.target.checked })}
                />
                <div>
                  <span className="font-medium block">Allow orders</span>
                  <span className="text-xs text-gray-500 font-normal">Users can place orders on products</span>
                </div>
              </label>
            </div>
          </div>

          {/* Communications */}
          <div className="space-y-6 md:col-span-2">
            <h2 className="text-xl font-bold text-white pb-4 border-b border-white/10 mt-4">Communications</h2>
            
            <label className={labelClass}>
              Maintenance message
              <textarea
                className={`${inputClass} min-h-[100px] resize-y`}
                placeholder="Leave blank if the platform is operating normally. If text is entered here, it will be shown to all users."
                value={form.maintenanceMessage ?? ''}
                onChange={(e) => setForm({ ...form, maintenanceMessage: e.target.value || null })}
              />
            </label>
            
            <label className={labelClass}>
              WhatsApp template
              <textarea
                className={`${inputClass} min-h-[100px] resize-y font-mono text-sm`}
                required
                value={form.whatsappMessageTemplate}
                onChange={(e) => setForm({ ...form, whatsappMessageTemplate: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-2">Available variables: {'{product}'}, {'{price}'}, {'{link}'}, {'{seller}'}</p>
            </label>
          </div>
        </div>

        {msg && (
          <div className={`mt-8 p-4 rounded-xl border text-sm font-medium flex items-center gap-2 ${
            m.isError 
              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}>
            {m.isError ? <AlertTriangleIcon className="w-5 h-5 shrink-0" /> : <CheckCircleIcon className="w-5 h-5 shrink-0" />}
            {msg}
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-white/10 flex justify-end">
          <button 
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg" 
            disabled={m.isPending}
          >
            {m.isPending ? 'Saving settings...' : <><SaveIcon className="w-5 h-5" /> Save settings</>}
          </button>
        </div>
      </form>
    </section>
  )
}
