// CONFIGURE UI → FLOWS — every journey across the app's forms.
//
// A flow is screens one after another: what someone fills in on one decides
// which comes next. It is run by Xeplr Workflow, so a journey can be left and
// picked up later — by someone else, on another day. Design it here; open it
// at /journey/<key>.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { flows } from '../api/flows.js'

export default function Flows() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const navigate = useNavigate()

  const load = () => flows.listFlows().then(setList, (e) => setError(e.message))
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    const label = name.trim()
    if (!label) return
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    try {
      await flows.createFlow({ key, name: label })
      navigate(`/configure/flows/${key}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="app-forms">
      <p className="app-page-lead">
        A flow is your forms, one after another — what someone fills in decides the next one.
        Xeplr Workflow runs it, so a journey can be left and picked up later.
      </p>
      {error && <div className="app-error">{error}</div>}

      <form className="app-forms-new" onSubmit={create}>
        <label className="app-forms-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee registration" />
        </label>
        <button type="submit" className="app-btn" disabled={!name.trim()}>New flow</button>
      </form>

      {list && list.length === 0 && <p className="app-sub">No flows yet.</p>}
      {list && list.length > 0 && (
        <table className="app-table">
          <thead><tr><th>Flow</th><th>Key</th><th>Status</th><th>Screens</th><th /></tr></thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.key}>
                <td><strong>{f.name}</strong></td>
                <td className="app-sub">{f.key}</td>
                <td>{f.status}</td>
                <td>{typeof f.steps === 'number' ? f.steps : (f.steps || []).length}</td>
                <td className="app-row-actions">
                  <Link to={`/configure/flows/${f.key}`}>Design</Link>
                  {f.status === 'published' && <Link to={`/journey/${f.key}`}>Open</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
