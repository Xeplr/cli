// CONFIGURE UI → MASTERS — the lists the rest of the app points at.
//
// Departments, statuses, countries, categories: small tables that other forms
// choose from. They are ordinary forms with a flag (Design → This is a
// master), so they have a table, a list, an edit screen and permissions like
// anything else — a master is a fact about a form, not a kind of form.
//
// They are gathered HERE rather than scattered through the side rail because
// that is what they are: reference data somebody maintains occasionally, not
// pages people work in daily. The rail stays for the work.
//
// Which forms are masters is @xeplr/ui-factory's answer (`useScreenSource`),
// not this app's — grouping two screens into a form and reading the flag is
// the same code in every app, and a copy here could never be fixed centrally.
import { Link } from 'react-router-dom'
import { useScreenSource, FactoryBuilder } from '@xeplr/ui-factory'
import { factory } from '../api/factory.js'

export default function Masters() {
  const { masters, loading } = useScreenSource(factory, { Builder: FactoryBuilder })

  if (loading) return <p className="app-sub">Loading…</p>

  return (
    <div className="app-forms">
      <p className="app-page-lead">
        The lists the rest of the app chooses from. Mark a form as a master in its design
        (select nothing on the canvas → <strong>This is a master</strong>) and it appears here.
      </p>

      {masters.length === 0 && (
        <p className="app-sub">
          No masters yet. A department list, a status list, a country list — anything other
          forms point at.
        </p>
      )}

      {masters.length > 0 && (
        <table className="app-table">
          <thead><tr><th>Master</th><th>Shown as</th><th>Table</th><th /></tr></thead>
          <tbody>
            {masters.map((m) => (
              <tr key={m.key}>
                <td><strong>{m.name}</strong></td>
                {/* What a picker shows for one of its records — said once on
                    the master, not again on every dropdown pointing at it. */}
                <td className="app-sub">{m.labelField || '—'}</td>
                <td className="app-sub">{m.source || '—'}</td>
                <td className="app-row-actions">
                  {/* Its records: the list screen is what looking at a master
                      means. Its design is where the flag was set. */}
                  <Link to={`/forms/${m.key}`}>Open</Link>
                  <Link to={`/configure/forms/${m.key}/design/form`}>Design</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
