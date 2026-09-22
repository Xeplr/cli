// ONE FLOW, ON WORKFLOW'S OWN CANVAS.
//
// The designer is a component from @xeplr/ui-workflow — the same one BI and
// every other xeplr product uses — dropped straight onto this page. It is not
// a section mounted at URLs of its own: this app already has a page for it,
// inside its own shell, and the designer renders where it is put.
//
// There used to be a second, screens-only builder here (@xeplr/ui-factory's
// FlowBuilder). One designer over one engine is the point: the trigger box,
// the condition boxes and the reference pickers are built once, and this app
// gets them by upgrading a package.
//
// THIS APP'S FORMS ARE THE FLOW'S SCREENS. A step can show one and wait for
// somebody to fill it in, and `useScreenSource` is @xeplr/ui-factory's answer
// to the two things the designer asks its host: which screens exist (with
// what each one hands back, so a later step can pick `title` by name) and how
// to design one without leaving the flow. Two props, because the alternative
// was the same twenty lines in every app — and a copy in your app could never
// be fixed once.
//
// WHERE THE API IS: /api/workflow, always — the dev proxy (vite.config.js) or
// nginx decides whether that is this API or Workflow on its own port.
import { useParams, useNavigate } from 'react-router-dom'
import { WorkflowDesigner } from '@xeplr/ui-workflow'
import { useScreenSource, FactoryBuilder } from '@xeplr/ui-factory'
import { factory } from '../api/factory.js'

export default function FlowDesigner() {
  const { flow: key } = useParams()
  const navigate = useNavigate()
  const { screens, screenEditor } = useScreenSource(factory, { Builder: FactoryBuilder })

  return (
    <div className="app-designer">
      <WorkflowDesigner
        apiBase="/api/workflow"
        screens={screens}
        screenEditor={screenEditor}
        // BY KEY, because that is what this app's URLs carry:
        // /configure/flows/leave_request. A flow is created on the Flows page
        // with a key made from its name, and that key is how it is addressed
        // for the rest of its life — a readable link that survives a rebuild
        // minting new ids.
        workflowKey={key === 'new' ? undefined : key}
        newKind={key === 'new' ? 'workflow' : undefined}
        // Only reachable from /configure/flows/new, which this app does not
        // link to — the Flows page creates the flow first, so the designer
        // always opens on one that exists.
        onOpened={(saved) => navigate('/configure/flows/' + saved, { replace: true })}
        onBack={() => navigate('/configure?tab=flows')}
      />
    </div>
  )
}
