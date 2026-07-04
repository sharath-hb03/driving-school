import { createContext, useContext, useCallback, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), [])
  const close = (result) => { state?.resolve(result); setState(null) }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state} onClose={() => close(false)}
        title={state?.title || 'Are you sure?'} size="sm"
        footer={
          <div className="flex gap-3">
            <button className="btn-ghost flex-1" onClick={() => close(false)}>{state?.cancelText || 'Cancel'}</button>
            <button className={`flex-1 ${state?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {state?.confirmText || 'Confirm'}
            </button>
          </div>
        }
      >
        <div className="flex gap-3">
          {state?.danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <p className="text-[15px] text-slate-600">{state?.message}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
