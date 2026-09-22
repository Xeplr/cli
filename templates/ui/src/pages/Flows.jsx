// CONFIGURE UI → FLOWS — every journey across the app's forms.
//
// A flow is what someone is walked through: screens one after another, and
// whatever has to happen between them. What they fill in on one decides which
// comes next. Xeplr Workflow runs it, so a journey can be left and picked up
// later — by someone else, on another day. Design it here; open it at
// /journey/<key>.
//
// A FLOW IS AN ORDINARY WORKFLOW, addressed by a key this page makes from its
// name. It used to be created as kind 'screens', which is a workflow whose
// steps are GENERATED from a design held in another app — and that app was
// the screens-only builder this one replaced. The designer then had to refuse
// to edit its own flows ("designed in Configure UI"), which is how a flow
// became a page you could open and not change.
//
// So a flow is a workflow now, and every kind of step is available inside it:
// a Screen for the part a person fills in, an Action for the email that goes
// out after it, a Condition for where it goes next. Flows created the old way
// still appear here and still run; the designer shows them read-only.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listWorkflows, saveWorkflow, configureWorkflowApi } from '@xeplr/ui-workflow'

// The same mount the designer uses. Said here as well because this page can
// be the first one to ask, and a base set after the first request is too late.
configureWorkflowApi('/api/workflow')

export default function Flows() {
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [offline, setOffline] = useState(null)   // API_NOT_RESTARTED
  const [name, setName] = useState('')
  const navigate = useNavigate()

  const load = () => listWorkflows().then(setList, (e) => {
    const off = flowsOffline(e)
    if (off) setOffline(off)
    else setError(e.message)
  })
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    const label = name.trim()
    if (!label) return
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    try {
      // No steps: the designer is where those come from, and it opens on the
      // flow this creates. `key` is what every link to it uses from here on.
      await saveWorkflow({ name: label, key, kind: 'workflow', status: 'draft' })
      navigate(`/configure/flows/${key}`)
    } catch (err) {
      setError(err.message)
    }
  }

  if (offline) return <NotConnected offline={offline} />

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
              <tr key={f.id || f.key}>
                <td><strong>{f.name}</strong></td>
                <td className="app-sub">{f.key || '—'}</td>
                <td>{f.kind === 'screens' ? f.status + ' · read-only' : f.status}</td>
                <td>{typeof f.steps === 'number' ? f.steps : (f.steps || []).length}</td>
                <td className="app-row-actions">
                  {f.key && <Link to={`/configure/flows/${f.key}`}>Design</Link>}
                  {/* PUBLISHING IS A SCREENS-FLOW IDEA: there, publish is what
                      checks the design before somebody is walked through it.
                      A flow drawn in the designer has no such step, so it can
                      be opened as soon as it has one. */}
                  {(f.kind === 'screens' ? f.status === 'published' : (f.steps || []).length > 0) && f.key && (
                    <Link to={`/journey/${f.key}`}>Open</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * Why flows cannot run right now, or null when the error is something else.
 * Workflow runs inside this app's API, so there is one such case left: an API
 * started before flows existed (404 on /api/flows) — restart it.
 */
export function flowsOffline(err) {
  if (err && err.status === 404) return { code: 'API_NOT_RESTARTED', message: 'This app\'s API does not have the flows route yet.' }
  return null
}

/** Flows before the API has been restarted with them. */
export function NotConnected({ offline }) {
  return (
    <div className="app-forms">
      <div className="app-connect">
        <h2>Restart the API to use flows</h2>
        <p>{offline.message} It was started before flows were added — restart it, then reload this page.</p>
      </div>
    </div>
  )
}
