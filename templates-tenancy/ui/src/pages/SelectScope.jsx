// THE FIRST SCREEN AFTER SIGNING IN — choose the __MT_LEVEL_NAMES__ to work in.
//
// Everything the app shows and saves afterwards belongs to that choice:
// authFetch sends it as a header on every request, the API stamps new rows
// with it and reads only its rows.
//
// Shown once per browser tab (ScopeGate below), with the last choice already
// selected, so returning is one click. "__MT_SWITCH_NAME__" in the side rail
// comes back here.
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  authFetch, getActiveScope, setActiveScope, getLastScope, setLastScope, saveReturnTo, consumeReturnTo
} from '@xeplr/ui-account'
import { tenancy } from '../tenancy.js'
import './SelectScope.css'

// Per tab: a new tab, or a new sign-in, asks again.
const CONFIRMED = 'app:scopeConfirmed'
const confirmed = () => { try { return sessionStorage.getItem(CONFIRMED) === '1' } catch (e) { return false } }
const setConfirmed = (yes) => { try { yes ? sessionStorage.setItem(CONFIRMED, '1') : sessionStorage.removeItem(CONFIRMED) } catch (e) {} }

/** Lets the app's pages render only once every level is chosen in this tab. */
export function ScopeGate({ children }) {
  const location = useLocation()
  const complete = tenancy.levels.every((l) => getActiveScope(l.key))
  if (!complete || !confirmed()) {
    saveReturnTo(location)
    return <Navigate to="/select" replace />
  }
  return children
}

export default function SelectScope() {
  const navigate = useNavigate()
  // What is chosen so far, per level — starting from the active or last choice.
  // Made active straight away — before the lists below load, since a level's
  // list is asked for with the level above it as a header.
  const [chosen, setChosen] = useState(() => {
    const start = Object.fromEntries(tenancy.levels.map((l) => [l.key, getActiveScope(l.key) || getLastScope(l.key) || null]))
    tenancy.levels.forEach((l) => setActiveScope(l.key, start[l.key]))
    return start
  })

  const choose = useCallback((index, item) => {
    setChosen((c) => {
      const next = { ...c, [tenancy.levels[index].key]: item }
      // A different parent: whatever was chosen below it belonged to the old one.
      tenancy.levels.slice(index + 1).forEach((l) => { next[l.key] = null })
      return next
    })
    // Set as it is chosen, so the level below lists this one's children.
    setActiveScope(tenancy.levels[index].key, item)
    tenancy.levels.slice(index + 1).forEach((l) => setActiveScope(l.key, null))
    setConfirmed(false)
  }, [])

  const complete = tenancy.levels.every((l) => chosen[l.key])

  const go = () => {
    tenancy.levels.forEach((l) => { setActiveScope(l.key, chosen[l.key]); setLastScope(l.key, chosen[l.key]) })
    setConfirmed(true)
    navigate(consumeReturnTo() || '/home', { replace: true })
  }

  return (
    <div className="app-select">
      <h1>Where are you working?</h1>
      <p className="app-page-lead">Everything you see and save next belongs to this choice.</p>

      {tenancy.levels.map((level, i) => {
        const parentChosen = tenancy.levels.slice(0, i).every((l) => chosen[l.key])
        return (
          <LevelChoice
            key={level.key + (i ? ':' + (chosen[tenancy.levels[i - 1].key] || {}).id : '')}
            level={level}
            enabled={parentChosen}
            value={chosen[level.key]}
            onChoose={(item) => choose(i, item)}
          />
        )
      })}

      <button type="button" className="app-btn" disabled={!complete} onClick={go}>Continue</button>
    </div>
  )
}

function LevelChoice({ level, enabled, value, onChoose }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const noun = level.label.toLowerCase()

  useEffect(() => {
    if (!enabled) return
    authFetch('/api/tenants/' + level.key).then((body) => {
      const rows = body.dataArray || []
      setItems(rows)
      // A remembered choice that is no longer on the list is not a choice.
      if (value && !rows.some((r) => r.id === value.id)) onChoose(null)
      else if (!value && rows.length === 1) onChoose(rows[0])
    }, (e) => setError(e.message))
  }, [enabled, level.key])            // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const body = await authFetch('/api/tenants/' + level.key, { method: 'POST', body: JSON.stringify({ name: adding }) })
      const created = body.dataArray[0]
      setItems((list) => [...(list || []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setAdding('')
      setError(null)
      onChoose(created)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={'app-select-level' + (enabled ? '' : ' is-disabled')}>
      <h2>{level.label}</h2>
      {!enabled && <p className="app-sub">Choose the one above first.</p>}
      {enabled && items === null && !error && <p className="app-sub">Loading…</p>}
      {error && <div className="app-error">{error}</div>}
      {enabled && items && (
        <>
          {items.length === 0 && <p className="app-sub">No {noun} yet — add the first one.</p>}
          <div className="app-select-items">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={'app-select-item' + (value && value.id === item.id ? ' is-chosen' : '')}
                aria-pressed={!!value && value.id === item.id}
                onClick={() => onChoose(item)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <form className="app-select-add" onSubmit={add}>
            <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={'New ' + noun + ' name'} aria-label={'New ' + noun + ' name'} />
            <button type="submit" className="app-btn app-btn-quiet" disabled={busy || !adding.trim()}>Add {noun}</button>
          </form>
        </>
      )}
    </section>
  )
}
