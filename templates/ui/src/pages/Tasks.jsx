// THE SAMPLE — a list of tasks. New and Edit open the task form in a popup,
// where it saves itself as you type; there is no Save button.
//
// Nothing about tasks is written in this file. The list and the form are
// SCREENS, designed on the Forms page and stored by the API; this page only
// loads the published "task_list" and hands it the calls it needs.
import { useEffect, useState } from 'react'
import { FactoryScreen } from '@xeplr/ui-factory'
import { factory } from '../api/factory.js'
import TasksHelp from './TasksHelp.jsx'

export default function Tasks() {
  const [screen, setScreen] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    factory.loadScreen('task_list').then(setScreen, (e) => setError(e.message))
  }, [])

  return (
    <div className="app-page app-page-split">
      <div className="app-page-main">
        {error && <div className="app-error">Could not load the task list — {error}</div>}
        {/* loadScreen lets the list's Edit / New fetch "task_edit" when first opened. */}
        {screen && <FactoryScreen document={screen} {...factory.screenProps} />}
      </div>
      <TasksHelp />
    </div>
  )
}
