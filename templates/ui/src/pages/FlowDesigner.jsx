// One flow, on the canvas: the published forms on the left, arrows between
// them, and on the right what happens after the screen you picked. Saves
// itself; Publish is what people then walk through.
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FlowBuilder } from '@xeplr/ui-factory'
import { flows } from '../api/flows.js'
import { factory } from '../api/factory.js'

export default function FlowDesigner() {
  const { flow: key } = useParams()
  const [flow, setFlow] = useState(null)
  const [screens, setScreens] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    flows.loadFlow(key).then(setFlow, (e) => setError(e.message))
    // A step is a FORM (an edit screen) that is published: what people will
    // actually see, and something they can fill in.
    factory.listScreens().then((rows) => setScreens(rows
      .filter((s) => /_edit$/.test(s.screenKey) && s.version !== null)
      .map((s) => ({ id: s.screenKey, name: s.name }))), () => {})
  }, [key])

  if (error) return <div className="app-page"><div className="app-error">{error}</div></div>
  if (!flow) return null
  return (
    <div className="app-designer">
      <div className="app-designer-bar">
        <Link to="/configure?tab=flows">← All flows</Link>
      </div>
      <div className="app-designer-canvas">
        <FlowBuilder {...flows.builderProps} flow={flow} screens={screens} loadScreen={factory.loadScreen} />
      </div>
    </div>
  )
}
