'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clinic } from '@/lib/types'
import ClinicPicker from '@/components/ClinicPicker'
import SequenceList from '@/components/SequenceList'
import LoadingOverlay from '@/components/ui/LoadingOverlay'
import Modal, { ModalType } from '@/components/ui/Modal'
import Toast, { ToastType } from '@/components/ui/Toast'
import Image from 'next/image'
import { QrCode, Printer, UserPlus, CheckCircle2, ListOrdered, Hospital, AlertCircle } from 'lucide-react'

const P = '#22394d'

interface QrResult {
  hn: string; qrDataUrl: string; deepLink: string
  sequence: Array<{ clinicId: string; name: string; detail: string }>
}
interface ModalState { type: ModalType; title: string; message: string; confirmLabel?: string; onConfirm?: () => void }
interface ToastState { type: ToastType; message: string; key: number }

export default function RegisterPage() {
  const [hn, setHn] = useState('')
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [ordered, setOrdered] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('Processing...')
  const [result, setResult] = useState<QrResult | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    fetch('/api/clinics').then(r => r.json()).then(setClinics)
      .catch(() => showToast('error', 'Failed to load clinics'))
  }, [])

  useEffect(() => {
    setOrdered(prev => {
      const kept = prev.filter(id => selected.includes(id))
      const added = selected.filter(id => !kept.includes(id))
      return [...kept, ...added]
    })
  }, [selected])

  const clinicMap = Object.fromEntries(clinics.map(c => [c.clinicId, c]))

  function showToast(type: ToastType, message: string) {
    setToast({ type, message, key: Date.now() })
  }

  function showModal(state: ModalState) { setModal(state) }
  function closeModal() { setModal(null) }

  async function doRegister() {
    setLoadingMsg('Registering patient & generating QR...')
    setLoading(true)
    try {
      const res = await fetch('/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hn: hn.trim(), clinicIds: ordered }),
      })
      const data = await res.json()
      if (!res.ok) {
        showModal({ type: 'error', title: 'Registration Failed', message: data.error ?? 'An unexpected error occurred. Please try again.' })
        return
      }
      setResult(data)
      showToast('success', `HN ${data.hn} registered successfully`)
    } catch {
      showModal({ type: 'error', title: 'Connection Error', message: 'Could not reach the server. Please check your connection and try again.' })
    } finally { setLoading(false) }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hn.trim()) {
      showModal({ type: 'warning', title: 'HN Required', message: 'Please enter the Hospital Number (HN) before proceeding.' })
      return
    }
    if (!ordered.length) {
      showModal({ type: 'warning', title: 'No Clinics Selected', message: 'Please select at least one clinic for this patient\'s journey.' })
      return
    }
    // Confirm before registering
    showModal({
      type: 'confirm',
      title: 'Confirm Registration',
      message: `Register patient HN: ${hn.trim()} with ${ordered.length} clinic(s) and generate a QR code?`,
      onConfirm: () => { closeModal(); doRegister() },
    })
  }

  function confirmReset() {
    showModal({
      type: 'confirm',
      title: 'Register New Patient?',
      message: 'This will clear the current QR. Are you sure you want to register a new patient?',
      onConfirm: () => {
        closeModal()
        setHn(''); setSelected([]); setOrdered([]); setResult(null)
        showToast('info', 'Ready to register a new patient')
      },
    })
  }

  function confirmPrint() {
    showModal({
      type: 'info',
      title: 'Print QR Code',
      message: `Printing QR for HN: ${result?.hn}. Ensure the patient scans this QR to link their LINE account.`,
      confirmLabel: 'Print',
      onConfirm: () => { closeModal(); window.print() },
    })
  }

  /* ── QR Result Screen ── */
  if (result) {
    return (
      <>
        <LoadingOverlay show={loading} message={loadingMsg} />
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

        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <h1 className="page-title">Registration Complete</h1>
            <p className="page-subtitle">Ask the patient to scan the QR code to link their LINE account</p>
          </div>

          <div className="card p-8">
            {/* ── QR + HN, perfectly centered ── */}
            <div className="flex flex-col items-center text-center gap-4 mb-7">
              {/* QR box */}
              <div
                className="rounded-3xl p-4 flex items-center justify-center"
                style={{
                  background: `${P}07`,
                  border: `2px dashed ${P}35`,
                  width: 280, height: 280,
                }}
              >
                <Image
                  src={result.qrDataUrl}
                  alt="QR Code"
                  width={240}
                  height={240}
                  className="rounded-2xl"
                />
              </div>

              {/* HN badge — centered directly under QR */}
              <div
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-base font-bold"
                style={{ background: `${P}12`, color: P }}
              >
                <CheckCircle2 size={17} />
                HN:&nbsp;{result.hn}
              </div>

              <p className="text-sm text-gray-400">Patient scans this QR to link their LINE account</p>
            </div>

            {/* Clinic sequence */}
            <div className="rounded-2xl p-5 mb-7" style={{ background: `${P}06` }}>
              <div className="flex items-center gap-2 mb-4">
                <ListOrdered size={14} style={{ color: P }} />
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P }}>
                  Clinic Sequence
                </p>
              </div>
              <div className="space-y-2.5">
                {result.sequence.map((s, i) => (
                  <div key={s.clinicId} className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg,#2c4d67,${P})` }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-base font-medium text-gray-700 flex-1">{s.name}</span>
                    {i === result.sequence.length - 1 && (
                      <span className="text-xs font-bold text-gray-400 tracking-wide">LAST</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={confirmPrint} className="btn-ghost flex-1 py-3.5">
                <Printer size={15} /> Print QR
              </button>
              <button onClick={confirmReset} className="btn-primary flex-1 py-3.5">
                <UserPlus size={15} /> New Patient
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* ── Registration Form ── */
  return (
    <>
      <LoadingOverlay show={loading} message={loadingMsg} />
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

      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="page-title">Register Patient</h1>
          <p className="page-subtitle">Create a clinic journey and generate a LINE QR code</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* HN */}
          <div className="card p-6">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              Hospital Number (HN) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={hn}
              onChange={e => setHn(e.target.value)}
              placeholder="e.g. HN0001"
              className="input-field text-lg"
            />
          </div>

          {/* Clinics */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Hospital size={15} className="text-gray-400" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Select Clinics <span className="text-red-400">*</span>
              </p>
            </div>
            <ClinicPicker clinics={clinics} selected={selected} onChange={setSelected} />
          </div>

          {/* Sequence */}
          {ordered.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <ListOrdered size={15} className="text-gray-400" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Visit Order</p>
              </div>
              <SequenceList clinicIds={ordered} clinicMap={clinicMap} onChange={setOrdered} />
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-4 text-base rounded-2xl">
            <QrCode size={18} /> Generate QR Code
          </button>
        </form>
      </div>
    </>
  )
}
