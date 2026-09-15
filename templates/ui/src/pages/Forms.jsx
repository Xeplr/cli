// FORMS — every UI in the app (Configure UI → Forms). Make one, design it,
// publish it, open it, add it to the side rail.
//
// A form is two screens: a LIST of its records, and the add / edit FORM the list
// opens in a popup. Its KEY (farming_department) names the screens and the table
// (farming_departments) and cannot change once published; its LABEL is what
// people see, renamed any time in its design.
//
// Claude can make forms too — see "Create a new UI" in CLAUDE.md.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listMenuItems, addMenuItem, removeMenuItem, useAccess } from '@xeplr/ui-account'
import { factory } from '../api/factory.js'
import { FORM_MENU_PREFIX } from '../menu.js'

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

/** "Farming departments" → "farming_department": a suggestion, editable. */
function suggestKey(label) {
  const words = String(label).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  if (!words.length) return ''
  const last = words[words.length - 1]
  words[words.length - 1] = /ies$/.test(last) ? last.slice(0, -3) + 'y' : /(ss|us)$/.test(last) ? last : last.replace(/s$/, '')
  const key = words.join('_')
  return /^[a-z]/.test(key) ? key : 'form_' + key
}

export default function Forms() {
  const navigate = useNavigate()
  const { refreshAccess } = useAccess()
  const [forms, setForms] = useState(null)
  const [inMenu, setInMenu] = useState(new Set())
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [busy, setBusy] = useState(null)

  const load = useCallback(() => {
    factory.listScreens().then((rows) => { setForms(groupForms(rows)); setError(null) }, (e) => setError(e.message))
    listMenuItems().then(
      (items) => setInMenu(new Set(items.filter((m) => m.name.startsWith(FORM_MENU_PREFIX) && !m.isHidden).map((m) => m.name.slice(FORM_MENU_PREFIX.length)))),
      () => {}
    )
  }, [])
  useEffect(load, [load])

  const onLabel = (value) => {
    setLabel(value)
    if (!keyEdited) setKey(suggestKey(value))
  }

  const create = async (e) => {
    e.preventDefault()
    setBusy('new')
    try {
      const made = await factory.createEntity({ key: key.trim(), label: label.trim() })
      navigate('/configure/forms/' + made.key + '/design/form')
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
      setError(err.confirm
        ? 'Publishing "' + form.name + '" would remove columns and their data — open Design form and publish there to see what, and confirm.'
        : err.message)
    } finally {
      setBusy(null)
    }
  }

  const toggleMenu = async (form) => {
    setBusy(form.key)
    try {
      if (inMenu.has(form.key)) await removeMenuItem(FORM_MENU_PREFIX + form.key)
      else await addMenuItem({ name: FORM_MENU_PREFIX + form.key, label: form.name })
      await refreshAccess()
      setNotice(inMenu.has(form.key) ? 'Removed "' + form.name + '" from the menu' : 'Added "' + form.name + '" to the menu — rename or move it in the Menu tab')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="app-forms">
      <p className="app-page-lead">
        Every UI in the app. A new one starts with a Name field — add the rest in its design, then publish to create its table.
      </p>

      <form className="app-forms-new" onSubmit={create}>
        <label className="app-forms-field">
          <span>Label — what people see</span>
          <input value={label} onChange={(e) => onLabel(e.target.value)} placeholder="Farming departments" />
        </label>
        <label className="app-forms-field">
          <span>Key — names its table; fixed once published</span>
          <input value={key} onChange={(e) => { setKey(e.target.value); setKeyEdited(true) }} placeholder="farming_department" />
        </label>
        <button type="submit" className="app-btn" disabled={!key.trim() || busy === 'new'}>
          {busy === 'new' ? 'Creating…' : 'New form'}
        </button>
      </form>

      {error && <div className="app-error">{error}</div>}
      {notice && <div className="app-notice">{notice}</div>}

      {forms && forms.length === 0 && <p className="app-sub">No forms yet.</p>}
      {forms && forms.length > 0 && (
        <table className="app-table">
          <thead>
            <tr><th>Label</th><th>Table</th><th>Form</th><th>List</th><th /></tr>
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
                    {form.edit && <button className="app-btn app-btn-quiet" onClick={() => navigate('/configure/forms/' + form.key + '/design/form')}>Design form</button>}
                    {form.list && <button className="app-btn app-btn-quiet" onClick={() => navigate('/configure/forms/' + form.key + '/design/list')}>Design list</button>}
                    <button className="app-btn app-btn-quiet" disabled={!canOpen || busy === form.key} title={canOpen ? '' : 'Publish it first'} onClick={() => toggleMenu(form)}>
                      {inMenu.has(form.key) ? 'Remove from menu' : 'Add to menu'}
                    </button>
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
