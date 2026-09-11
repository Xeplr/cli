// DESIGN LAYER — presentation only. Every value and every handler comes from
// the controller; there is no logic here to get out of step with it.
import { useTasksController } from '../useTasksController.js'
import TasksHelp from './TasksHelp.jsx'

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' }
]

export default function Tasks() {
  const { tasks, form, setField, submit, edit, cancel, remove, editingId, busy, error } =
    useTasksController()

  return (
    <div className="app-page app-page-split">
      <div className="app-page-main">
      <h1>Tasks</h1>
      <p className="app-page-lead">
        A sample form and list. One model, one migration, one line of routing.
      </p>

      {error && <div className="app-error">{error}</div>}

      <form className="app-form" onSubmit={submit}>
        <label className="app-field">
          <span>Title</span>
          <input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="What needs doing?"
            required
          />
        </label>

        <label className="app-field">
          <span>Description</span>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Optional"
          />
        </label>

        <div className="app-field-row">
          <label className="app-field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          <label className="app-field">
            <span>Due date</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setField('dueDate', e.target.value)}
            />
          </label>
        </div>

        <div className="app-form-actions">
          <button type="submit" className="app-btn" disabled={busy}>
            {editingId ? 'Save changes' : 'Add task'}
          </button>
          {editingId && (
            <button type="button" className="app-btn app-btn-quiet" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <table className="app-table">
        <thead>
          <tr><th>Title</th><th>Status</th><th>Due</th><th /></tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr><td colSpan={4} className="app-empty">No tasks yet. Add one above.</td></tr>
          )}
          {tasks.map((t) => (
            <tr key={t.id} className={editingId === t.id ? 'is-editing' : undefined}>
              <td>
                <strong>{t.title}</strong>
                {t.description && <div className="app-sub">{t.description}</div>}
              </td>
              <td><span className={'app-tag is-' + t.status}>{t.status.replace('_', ' ')}</span></td>
              <td>{t.dueDate ? String(t.dueDate).slice(0, 10) : '—'}</td>
              <td className="app-row-actions">
                <button className="app-btn app-btn-quiet" onClick={() => edit(t)}>Edit</button>
                <button className="app-btn app-btn-quiet" onClick={() => remove(t.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <TasksHelp />
    </div>
  )
}
