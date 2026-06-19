'use client'

import { useState, useEffect } from 'react'
import { Clinic } from '@/lib/types'
import LoadingOverlay from '@/components/ui/LoadingOverlay'
import Modal, { ModalType } from '@/components/ui/Modal'
import Toast, { ToastType } from '@/components/ui/Toast'
import { Plus, Edit2, Trash2, Lock, Building2, MapPin, X } from 'lucide-react'

const P = '#22394d'
const emptyClinic = (): Partial<Clinic> => ({ clinicId: '', name: '', detail: '', displayOrder: 0, active: true })

interface ModalState { type: ModalType; title: string; message: string; onConfirm?: () => void }
interface ToastState { type: ToastType; message: string; key: number }

export default function ClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [form, setForm] = useState<Partial<Clinic>>(emptyClinic())
  const [editing, setEditing] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  async function load() { const r = await fetch('/api/clinics'); setClinics(await r.json()) }
  useEffect(() => { load() }, [])

  function showToast(type: ToastType, msg: string) { setToast({ type, message: msg, key: Date.now() }) }
  function closeModal() { setModal(null) }
  function startEdit(c: Clinic) { setEditing(c.clinicId); setForm({ ...c }) }
  function startAdd() { setEditing('__new__'); setForm(emptyClinic()) }
  function cancel() { setEditing(null); setForm(emptyClinic()) }

  async function doSave() {
    if (!form.name?.trim()) {
      setModal({ type: 'warning', title: 'Name Required', message: 'Please enter a clinic name before saving.' })
      return
    }
    setLoading(true)
    try {
      const isNew = editing === '__new__'
      const res = await fetch('/api/clinics', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setModal({ type: 'error', title: 'Save Failed', message: data.error ?? 'Could not save clinic. Please try again.' })
        return
      }
      cancel()
      await load()
      showToast('success', isNew ? 'Clinic created successfully' : 'Clinic updated successfully')
    } catch {
      setModal({ type: 'error', title: 'Connection Error', message: 'Failed to reach the server.' })
    } finally { setLoading(false) }
  }

  function handleSave() {
    const isNew = editing === '__new__'
    setModal({
      type: 'confirm',
      title: isNew ? 'Create Clinic?' : 'Save Changes?',
      message: isNew
        ? `Create a new clinic named "${form.name}"?`
        : `Save changes to "${form.name}"?`,
      onConfirm: () => { closeModal(); doSave() },
    })
  }

  function handleDelete(c: Clinic) {
    setModal({
      type: 'confirm',
      title: 'Delete Clinic?',
      message: `Are you sure you want to delete "${c.name}"? This cannot be undone.`,
      onConfirm: () => { closeModal(); doDelete(c.clinicId) },
    })
  }

  async function doDelete(clinicId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/clinics', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModal({ type: 'error', title: 'Delete Failed', message: data.error ?? 'Could not delete clinic.' })
        return
      }
      await load()
      showToast('success', 'Clinic removed')
    } catch {
      setModal({ type: 'error', title: 'Connection Error', message: 'Failed to reach the server.' })
    } finally { setLoading(false) }
  }

  return (
    <>
      <LoadingOverlay show={loading} message="Saving changes..." />
      {modal && (
        <Modal
          {...modal}
          onCancel={modal.onConfirm ? closeModal : undefined}
          onClose={closeModal}
        />
      )}
      {toast && (
        <Toast key={toast.key} type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      <div>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="page-title">Clinic Management</h1>
            <p className="page-subtitle">Configure clinic master data and location details</p>
          </div>
          <button onClick={startAdd} className="btn-primary"><Plus size={16} /> Add Clinic</button>
        </div>

        {/* Add / Edit Modal */}
        {editing && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) cancel() }}
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative"
              style={{ animation: 'modalIn .2s cubic-bezier(.34,1.56,.64,1)' }}>
              <button onClick={cancel}
                className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X size={14} className="text-gray-500" />
              </button>

              <div className="flex items-center gap-3 mb-7">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${P}15` }}>
                  <Building2 size={20} style={{ color: P }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editing === '__new__' ? 'Add New Clinic' : 'Edit Clinic'}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {editing === '__new__' ? 'Create a new clinic entry' : 'Update clinic details'}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-7">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Clinic Name <span className="text-red-400">*</span>
                  </label>
                  <input autoFocus value={form.name ?? ''}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="input-field text-base" placeholder="e.g. Internal Medicine" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                    Location Detail
                  </label>
                  <input value={form.detail ?? ''}
                    onChange={e => setForm(f => ({ ...f, detail: e.target.value }))}
                    className="input-field text-base" placeholder="e.g. Floor 3, Zone A" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Display Order</label>
                    <input type="number" value={form.displayOrder ?? 0}
                      onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                      className="input-field" />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className="w-12 h-7 rounded-full relative transition-colors cursor-pointer"
                        style={{ background: form.active ? P : '#d1d5db' }}
                        onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                      >
                        <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
                      </div>
                      <span className="text-base text-gray-600 font-medium">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleSave} className="btn-primary flex-1 py-3.5 text-base">
                  {editing === '__new__' ? 'Create Clinic' : 'Save Changes'}
                </button>
                <button onClick={cancel} className="btn-ghost px-6 py-3.5">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="px-7 py-5 border-b border-gray-50 flex items-center justify-between">
            <p className="text-lg font-bold text-gray-800">All Clinics</p>
            <span className="badge text-xs" style={{ background: `${P}12`, color: P }}>{clinics.length} clinics</span>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50/70">
              <tr>
                {['Clinic', 'Location', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-7 py-4 text-left text-xs font-bold uppercase tracking-wide text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clinics.map(c => (
                <tr key={c.clinicId} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-7 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${P}12` }}>
                        {c.clinicId === 'BILLING' ? <Lock size={16} style={{ color: P }} /> : <Building2 size={16} style={{ color: P }} />}
                      </div>
                      <div>
                        <p className="font-semibold text-base text-gray-800">{c.name}</p>
                        {c.clinicId === 'BILLING' && (
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Lock size={9} /> fixed · cannot delete</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-7 py-5">
                    {c.detail
                      ? <span className="text-sm text-gray-400 flex items-center gap-1.5"><MapPin size={11} />{c.detail}</span>
                      : <span className="text-sm text-gray-200">—</span>}
                  </td>
                  <td className="px-7 py-5">
                    <span className={`badge ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-7 py-5">
                    {c.clinicId !== 'BILLING' ? (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(c)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors"
                          style={{ color: P, borderColor: `${P}30`, background: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${P}0a`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <Edit2 size={13} /> Edit
                        </button>
                        <button onClick={() => handleDelete(c)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-100 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    ) : <span className="text-sm text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
              {clinics.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-7 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: `${P}10` }}>
                        <Building2 size={28} style={{ color: `${P}60` }} />
                      </div>
                      <p className="text-base font-semibold text-gray-400">No clinics yet</p>
                      <button onClick={startAdd} className="btn-primary mt-1"><Plus size={15} /> Add First Clinic</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity:0; transform: scale(.9) translateY(12px); }
          to   { opacity:1; transform: scale(1)  translateY(0); }
        }
      `}</style>
    </>
  )
}
