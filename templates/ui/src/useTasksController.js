// CONTROLLER LAYER — state and handlers, no JSX.
//
// The same split the @xeplr/ui-* libraries use. A different design can import
// this hook and render the fields however it likes; the behaviour below is
// unchanged by that, which is what makes a rebrand safe.
import { useCallback, useEffect, useState } from 'react'
import { listTasks, saveTasks, deleteTasks } from './api/tasks.js'

const EMPTY = { title: '', description: '', status: 'todo', dueDate: '' }

export function useTasksController() {
  const [tasks, setTasks] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks())
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const setField = useCallback((name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
  }, [])

  const edit = useCallback((task) => {
    setEditingId(task.id)
    setForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      // The API returns a full timestamp; a date input wants just the day.
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : ''
    })
  }, [])

  const cancel = useCallback(() => {
    setEditingId(null)
    setForm(EMPTY)
  }, [])

  const submit = useCallback(async (e) => {
    if (e) e.preventDefault()
    setBusy(true)
    try {
      // An entry with no id is a create; with one, an update. Same call.
      const entry = { ...form, dueDate: form.dueDate || null }
      if (editingId) entry.id = editingId
      await saveTasks([entry])
      cancel()
      await refresh()
      setError(null)
    } catch (e2) {
      // The API refuses on the model's own jsonSchema and names the field, so
      // showing its message beats inventing our own.
      setError(e2.message)
    } finally {
      setBusy(false)
    }
  }, [form, editingId, cancel, refresh])

  const remove = useCallback(async (id) => {
    setBusy(true)
    try {
      await deleteTasks([id])
      if (editingId === id) cancel()
      await refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [editingId, cancel, refresh])

  return { tasks, form, setField, submit, edit, cancel, remove, editingId, busy, error, refresh }
}
