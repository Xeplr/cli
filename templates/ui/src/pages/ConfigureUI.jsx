// CONFIGURE UI — Super Admin, from the settings menu (top right).
//
//   Forms  every UI in the app: make one, design it, publish it, open it, add it
//          to the side rail
//   Menu   the side rail's items: rename, reorder, hide
//
// Configuration lives here, not in the side rail — the rail is for the pages
// people use.
import { useSearchParams } from 'react-router-dom'
import Forms from './Forms.jsx'
import MenuSettings from './MenuSettings.jsx'

const TABS = [
  { id: 'forms', label: 'Forms', Page: Forms },
  { id: 'menu', label: 'Menu', Page: MenuSettings }
]

export default function ConfigureUI() {
  const [params, setParams] = useSearchParams()
  const current = TABS.find((t) => t.id === params.get('tab')) || TABS[0]

  return (
    <div className="app-page app-configure">
      <h1>Configure UI</h1>
      <div className="app-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current.id}
            className={'app-tab' + (t.id === current.id ? ' is-active' : '')}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <current.Page />
    </div>
  )
}
