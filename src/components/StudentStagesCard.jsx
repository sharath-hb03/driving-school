import { useState, useEffect } from 'react'
import { Check, Edit2, Calendar, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'
import { Spinner } from './ui'
import Modal from './Modal'
import { TextInput, TextArea } from './Field'

function EditStageModal({ open, onClose, stage, student, onSaved }) {
  const [completed, setCompleted] = useState(false)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let progress = {}
    try {
      progress = student.stage_progress
        ? (typeof student.stage_progress === 'string' ? JSON.parse(student.stage_progress) : student.stage_progress)
        : {}
    } catch (e) {
      progress = {}
    }
    const sp = progress[stage.id] || {}
    setCompleted(!!sp.completed)
    setDate(sp.date || new Date().toISOString().split('T')[0])
    setNotes(sp.notes || '')
  }, [open, stage, student])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      let progress = {}
      try {
        progress = student.stage_progress
          ? (typeof student.stage_progress === 'string' ? JSON.parse(student.stage_progress) : student.stage_progress)
          : {}
      } catch (e) {
        progress = {}
      }

      progress[stage.id] = {
        completed,
        date: completed ? date : null,
        notes: completed ? notes.trim() : ''
      }

      await api.put(`/students/${student.id}`, { stage_progress: progress })
      toast.success('Stage details updated')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Update Stage - ${stage.name}`}
      footer={
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button form="edit-stage-modal-form" type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Save'}
          </button>
        </div>
      }
    >
      <form id="edit-stage-modal-form" onSubmit={submit} className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
            className="h-4.5 w-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Mark this stage as completed</span>
        </label>

        {completed && (
          <>
            <TextInput
              label="Completion Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <TextArea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add optional notes (e.g. Test score: 18/20)"
            />
          </>
        )}
      </form>
    </Modal>
  )
}

export default function StudentStagesCard({ student, stages = [], onSaved }) {
  const [activeModal, setActiveModal] = useState(null)

  let progress = {}
  try {
    progress = student.stage_progress
      ? (typeof student.stage_progress === 'string' ? JSON.parse(student.stage_progress || '{}') : student.stage_progress)
      : {}
  } catch (e) {
    progress = {}
  }

  const toggleStageQuick = async (stageId, isCurrentlyCompleted) => {
    let progressCopy = {}
    try {
      progressCopy = student.stage_progress
        ? (typeof student.stage_progress === 'string' ? JSON.parse(student.stage_progress || '{}') : student.stage_progress)
        : {}
    } catch (e) {
      progressCopy = {}
    }

    const nextCompleted = !isCurrentlyCompleted
    progressCopy[stageId] = {
      completed: nextCompleted,
      date: nextCompleted ? new Date().toISOString().split('T')[0] : null,
      notes: nextCompleted ? (progressCopy[stageId]?.notes || '') : ''
    }

    try {
      await api.put(`/students/${student.id}`, { stage_progress: progressCopy })
      toast.success(nextCompleted ? 'Stage completed!' : 'Stage marked pending')
      onSaved?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="card mt-4 p-5">
      <h2 className="mb-4 font-bold text-slate-800 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-brand-600" /> Student Progress Stages
      </h2>

      {stages.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-4">No stages configured. Set them up in Settings.</p>
      ) : (
        <div className="relative pl-2 space-y-5">
          {/* Vertical timeline line */}
          <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-slate-100" />

          {stages.map((stage, idx) => {
            const sp = progress[stage.id] || {}
            const isCompleted = !!sp.completed
            
            return (
              <div key={stage.id} className="relative flex items-start gap-4 group">
                {/* Timeline circle/checkbox */}
                <button
                  type="button"
                  onClick={() => toggleStageQuick(stage.id, isCompleted)}
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-95 ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600'
                      : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                  }`}
                  title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                >
                  <Check className="h-4.5 w-4.5 stroke-[3]" />
                </button>

                {/* Content */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-bold ${isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>
                      {stage.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveModal(stage)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-slate-400 hover:text-brand-600"
                      title="Edit Details"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isCompleted && (
                    <div className="mt-0.5 space-y-0.5">
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Completed {fmtDate(sp.date)}
                      </p>
                      {sp.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg py-1 px-2.5 inline-block max-w-full whitespace-pre-wrap">
                          {sp.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeModal && (
        <EditStageModal
          open={!!activeModal}
          onClose={() => setActiveModal(null)}
          stage={activeModal}
          student={student}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
