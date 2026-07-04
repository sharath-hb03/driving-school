import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api'

export function useApi(path, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mounted = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(path)
      if (mounted.current) setData(res)
    } catch (e) {
      if (mounted.current) setError(e)
    } finally {
      if (mounted.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps.length ? deps : [path])

  return { data, loading, error, reload: load, setData }
}
