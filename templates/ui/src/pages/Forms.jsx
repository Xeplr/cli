// FORMS — every form in the app, for Super Admin: see them, make a new one,
// design it, publish it, open it.
//
// A form is two screens: a LIST of its records, and the add / edit FORM the
// list opens in a popup. Records live in an ordinary table named for the form
// ("farming_departments"), created when the form is first published.
//
// Claude can make forms too (api/screens/, `npx xeplr-factory screens`); this
// page is the same thing by hand.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { factory } from '../api/factory.js'

/** listScreens rows → one entry per form: { key, name, source, list, edit }. */
function groupForms(rows) {
  const byKey = new Map()
  rows.forEach((row) => {
    const m = /^(.*)_(list|edit)$/.exec(row.screenKey)
    const key = m ? m[1] : row.screenKey
    const entry = byKey.get(key) || { key, name: null, source: null, list: null, edit: null }
    if (m) entry[m[2]] = row
    else entry.edit = row
    if (m && m[2] === 'list') entry.name = row.name
    entry.name = entry.name || row.name
    entry.source = entry.source || row.source
    byKey.set(key, entry)
  })
  return [...byKey.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

function state(screen) {
  if (!screen) return { label: '—', unpublished: false }
  if (screen.version === null) return { label: 'Not published yet', unpublished: true }
  return { label: 'v' + screen.version + (screen.hasDraft ? ' · unpublished changes' : ''), unpublished: screen.hasDraft }
}

export default function Forms() {
  const navigate = useNavigate()
  const [forms, setForms] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(null)

  const load = useCallback(() => {
    factory.listScreens().then((rows) => { setForms(groupForms(rows)); setError(null) }, (e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const create = async (e) => {
    e.preventDefault()
    setBusy('new')
    try {
      const made = await factory.createEntity({ entity: name })
      // Straight into its form, to add the fields.
      navigate('/forms/' + made.edit.replace(/_edit$/, '') + '/design/form')
    } catch (err) {
      setError(err.message)
      setBusy(null)
    }
  }

  // The form first — publishing it creates or changes the table — then the list.
  const publish = async (form) => {
    setBusy(form.key)
    setNotice(null)
    try {
      for (const screen of [form.edit, form.list]) {
        if (!screen || (screen.version !== null && !screen.hasDraft)) continue
        const row = await factory.loadDraft(screen.screenKey)
        await factory.publish(row.document)
      }
      setNotice('Published "' + form.name + '"')
      setError(null)
      load()
    } catch (err) {
      // Removing a field drops its column — that is confirmed in the designer,
      // where the columns and their values are shown.
      setError(err.confirm
        ? 'Publishing "' + form.name + '" would remove columns and their data — open Design form and publish there to see what, and confirm.'
        : err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="app-page app-forms">
      <h1>Forms</h1>
      <p className="app-page-lead">
        Every form in the app. A new one starts with a Name field — add the rest in its design, then publish to create its table.
      </p>

      <form className="app-forms-new" onSubmit={create}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='New form — one record is a… e.g. "farming department"'
          aria-label="New form name"
        />
        <button type="submit" className="app-btn" disabled={!name.trim() || busy === 'new'}>
          {busy === 'new' ? 'Creating…' : 'New form'}
        </button>
      </form>

      {error && <div className="app-error">{error}</div>}
      {notice && <div className="app-notice">{notice}</div>}

      {forms && forms.length === 0 && <p className="app-sub">No forms yet.</p>}
      {forms && forms.length > 0 && (
        <table className="app-table">
          <thead>
            <tr><th>Name</th><th>Table</th><th>Form</th><th>List</th><th /></tr>
          </thead>
          <tbody>
            {forms.map((form) => {
              const edit = state(form.edit)
              const list = state(form.list)
              const canOpen = form.list && form.list.version !== null
              return (
                <tr key={form.key}>
                  <td><strong>{form.name || form.key}</strong><div className="app-sub">{form.key}</div></td>
                  <td><code>{form.source || '—'}</code></td>
                  <td className={edit.unpublished ? 'app-forms-pending' : undefined}>{edit.label}</td>
                  <td className={list.unpublished ? 'app-forms-pending' : undefined}>{list.label}</td>
                  <td className="app-row-actions">
                    <button className="app-btn app-btn-quiet" disabled={!canOpen} title={canOpen ? '' : 'Publish it first'} onClick={() => navigate('/forms/' + form.key)}>Open</button>
                    {form.edit && <button className="app-btn app-btn-quiet" onClick={() => navigate('/forms/' + form.key + '/design/form')}>Design form</button>}
                    {form.list && <button className="app-btn app-btn-quiet" onClick={() => navigate('/forms/' + form.key + '/design/list')}>Design list</button>}
                    {(edit.unpublished || list.unpublished) && (
                      <button className="app-btn" disabled={busy === form.key} onClick={() => publish(form)}>
                        {busy === form.key ? 'Publishing…' : 'Publish'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
