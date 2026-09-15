// THE DESIGNER — change any screen: move and resize fields, add new ones,
// change labels, rules, fonts and colours.
//
// Your edits are kept as a DRAFT automatically. Nobody else sees them until
// you press Publish, which also changes the screen's database table to match:
// a new field adds a column; removing one asks first, because its column and
// every value in it would be deleted.
import { useCallback, useEffect, useState } from 'react'
import { FactoryBuilder } from '@xeplr/ui-factory'
import { factory } from '../api/factory.js'

export default function Designer() {
  const [screens, setScreens] = useState([])
  const [current, setCurrent] = useState(null)      // { key, document, lockedNames }
  const [error, setError] = useState(null)

  useEffect(() => {
    factory.listScreens().then((rows) => {
      setScreens(rows)
      if (rows.length) open(rows[0].screenKey)
    }, (e) => setError(e.message))
  }, [])                                              // eslint-disable-line react-hooks/exhaustive-deps

  const open = useCallback(async (key) => {
    try {
      // The draft if there is one, else the published version — with the field
      // names that are already columns, which the Designer will not let you rename.
      const row = await factory.loadDraft(key)
      setCurrent({ key, document: row.document, lockedNames: row.lockedNames || [] })
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  const publish = useCallback(async (doc, options) => {
    const result = await factory.publish(doc, options)
    // New columns are now locked names too.
    const row = await factory.loadDraft(doc.id)
    setCurrent((c) => (c && c.key === doc.id ? { ...c, lockedNames: row.lockedNames || [] } : c))
    return result
  }, [])

  return (
    <div className="app-designer">
      <div className="app-designer-bar">
        <span className="app-designer-title">Designer</span>
        {screens.map((s) => (
          <button
            key={s.screenKey}
            type="button"
            className={'app-btn app-btn-quiet' + (current && current.key === s.screenKey ? ' is-active' : '')}
            onClick={() => open(s.screenKey)}
          >
            {s.name || s.screenKey}
          </button>
        ))}
      </div>
      {error && <div className="app-error">{error}</div>}
      {current && (
        <div className="app-designer-canvas">
          <FactoryBuilder
            key={current.key}
            {...factory.builderProps}
            document={current.document}
            lockedNames={current.lockedNames}
            onPublish={publish}
            screens={screens.map((s) => ({ id: s.screenKey, name: s.name || s.screenKey }))}
          />
        </div>
      )}
    </div>
  )
}
