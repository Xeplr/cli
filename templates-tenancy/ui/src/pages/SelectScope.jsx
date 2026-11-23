// THE FIRST SCREEN AFTER SIGNING IN — choose the __MT_LEVEL_NAMES__ to work in.
//
// Everything the app shows and saves afterwards belongs to that choice:
// authFetch sends it as a header on every request, the API stamps new rows
// with it and reads only its rows.
//
// The picking is @xeplr/ui-account's (useScopeChoice) — the same as the phone
// app's (NativeScopePicker): each level's list, the last choice already
// chosen, a list of one chosen for you, adding a new one. This page only
// draws it. Shown once per browser tab (ScopeGate below); "__MT_SWITCH_NAME__"
// in the side rail comes back here.
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useScopeChoice, scopeChosen, saveReturnTo, consumeReturnTo } from '@xeplr/ui-account'
import { tenancy } from '../tenancy.js'
import './SelectScope.css'

// Per tab: a new tab, or a new sign-in, asks again.
const CONFIRMED = 'app:scopeConfirmed'
const confirmed = () => { try { return sessionStorage.getItem(CONFIRMED) === '1' } catch (e) { return false } }
const setConfirmed = (yes) => { try { yes ? sessionStorage.setItem(CONFIRMED, '1') : sessionStorage.removeItem(CONFIRMED) } catch (e) {} }

/** Lets the app's pages render only once every level is chosen in this tab. */
export function ScopeGate({ children }) {
  const location = useLocation()
  if (!scopeChosen(tenancy.levels) || !confirmed()) {
    saveReturnTo(location)
    return <Navigate to="/select" replace />
  }
  return children
}

export default function SelectScope() {
  const navigate = useNavigate()
  const choice = useScopeChoice({ levels: tenancy.levels })

  const go = () => {
    if (!choice.finish()) return
    setConfirmed(true)
    navigate(consumeReturnTo() || '/home', { replace: true })
  }

  return (
    <div className="app-select">
      <h1>Where are you working?</h1>
      <p className="app-page-lead">Everything you see and save next belongs to this choice.</p>

      {choice.levels.map((level, i) => (
        <section key={level.key} className={'app-select-level' + (level.enabled ? '' : ' is-disabled')}>
          <h2>{level.label}</h2>
          {!level.enabled && <p className="app-sub">Choose the one above first.</p>}
          {level.enabled && level.items === null && !level.error && <p className="app-sub">Loading…</p>}
          {level.error && <div className="app-error">{level.error}</div>}
          {level.enabled && level.items && (
            <>
              {level.items.length === 0 && <p className="app-sub">No {level.noun} yet — add the first one.</p>}
              <div className="app-select-items">
                {level.items.map((item) => {
                  const on = !!level.value && level.value.id === item.id
                  return (
                    <button key={item.id} type="button" className={'app-select-item' + (on ? ' is-chosen' : '')} aria-pressed={on}
                            onClick={() => { setConfirmed(false); choice.choose(i, item) }}>
                      {item.name}
                    </button>
                  )
                })}
              </div>
              <form className="app-select-add" onSubmit={(e) => { e.preventDefault(); setConfirmed(false); choice.add(i) }}>
                <input value={level.adding} onChange={(e) => choice.setAdding(i, e.target.value)} placeholder={'New ' + level.noun + ' name'} aria-label={'New ' + level.noun + ' name'} />
                <button type="submit" className="app-btn app-btn-quiet" disabled={level.busy || !level.adding.trim()}>Add {level.noun}</button>
              </form>
            </>
          )}
        </section>
      ))}

      <button type="button" className="app-btn" disabled={!choice.complete} onClick={go}>Continue</button>
    </div>
  )
}
