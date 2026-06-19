'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Clinic, Patient } from '@/lib/types'
import NurseQueue from '@/components/NurseQueue'
import LoadingOverlay from '@/components/ui/LoadingOverlay'
import Modal, { ModalType } from '@/components/ui/Modal'
import Toast, { ToastType } from '@/components/ui/Toast'
import { RefreshCw, Users, MapPin } from 'lucide-react'

const P = '#22394d'
const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ModalState { type: ModalType; title: string; message: string; onConfirm?: () => void }
interface ToastState { type: ToastType; message: string; key: number }

export default function NursePage() {
  const [clinicId, setClinicId] = useState('')
  const [processing, setProcessing] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const { data: clinics = [] } = useSWR<Clinic[]>('/api/clinics', fetcher)
  const { data: patients = [], isLoading, mutate } = useSWR<Patient[]>(
    clinicId ? `/api/patients?clinicId=${clinicId}` : null,
    fetcher, { refreshInterval: 10000 },
  )

  function showToast(type: ToastType, message: string) { setToast({ type, message, key: Date.now() }) }
  function closeModal() { setModal(null) }

  function handleMarkComplete(hn: string) {
    setModal({
      type: 'confirm',
      title: 'Mark as Complete?',
      message: `Confirm that patient HN: ${hn} has finished at this clinic. A LINE update will be sent.`,
      onConfirm: () => { closeModal(); doAdvance(hn) },
    })
  }

  async function doAdvance(hn: string) {
    setProcessing(true)
    try {
      const res = await fetch(`/api/patients/${hn}/advance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setModal({ type: 'error', title: 'Update Failed', message: data.error ?? 'Could not advance patient. Please try again.' })
      } else {
        showToast('success', `HN ${hn} marked complete — LINE message sent`)
        await mutate()
      }
    } catch {
      setModal({ type: 'error', title: 'Connection Error', message: 'Failed to connect to the server. Check your network.' })
    } finally { setProcessing(false) }
  }

  const activeClinics = (clinics as Clinic[]).filter(c => c.active)
  const selectedClinic = activeClinics.find(c => c.clinicId === clinicId)

  return (
    <>
      <LoadingOverlay show={processing} message="Updating patient & sending LINE message..." />
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
            <h1 className="page-title">Nurse Station</h1>
            <p className="page-subtitle">Select a clinic to manage the patient queue</p>
          </div>
          {clinicId && (
            <button onClick={() => mutate()} className="btn-ghost">
              <RefreshCw size={14} /> Refresh
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* Clinic selector */}
          <div className="card p-6 md:col-span-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Select Clinic
            </label>
            <select
              value={clinicId}
              onChange={e => setClinicId(e.target.value)}
              className="input-field text-base"
            >
              <option value="">— Choose a clinic —</option>
              {activeClinics.map(c => (
                <option key={c.clinicId} value={c.clinicId}>{c.name}</option>
              ))}
            </select>
            {selectedClinic?.detail && (
              <p className="text-sm text-gray-400 mt-2.5 flex items-center gap-1.5">
                <MapPin size={12} /> {selectedClinic.detail}
              </p>
            )}
          </div>

          {/* Queue count */}
          <div className="card p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${P}15` }}>
              <Users size={20} style={{ color: P }} />
            </div>
            <p className="text-4xl font-bold leading-none" style={{ color: P }}>
              {(patients as Patient[]).length}
            </p>
            <p className="text-sm text-gray-400 mt-1.5 font-medium">Patients waiting</p>
          </div>
        </div>

        {/* Queue */}
        {clinicId ? (
          <div className="card p-6">
            <NurseQueue
              patients={patients as Patient[]}
              clinicId={clinicId}
              onMarkComplete={handleMarkComplete}
              loading={isLoading}
            />
          </div>
        ) : (
          <div className="card p-20 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: `${P}10` }}>
              <Users size={28} style={{ color: `${P}60` }} />
            </div>
            <p className="text-lg font-semibold text-gray-400">Select a clinic to view the queue</p>
            <p className="text-base text-gray-300">Queue auto-refreshes every 10 seconds</p>
          </div>
        )}
      </div>
    </>
  )
}
