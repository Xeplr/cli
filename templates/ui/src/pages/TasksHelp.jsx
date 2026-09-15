// The panel beside the sample. It is here so the first thing anybody builds is
// explained where they are looking, rather than in a document they have to go
// and find.
// The same prompt as in CLAUDE.md. Replace the form and its fields.
const PROMPT = 'Create a new UI for farming departments. One record is a farming department with: Name (required), Region (dropdown: North, South, East, West), Area in acres (number, at least 0), Started on (date), Notes (long text). Show Name, Region and Area in the list. Follow "Create a new UI" in CLAUDE.md.'

export default function TasksHelp() {
  return (
    <aside className="app-help">
      <div className="app-help-badge">Sample</div>
      <h2>This page is an example</h2>
      <p>
        A task has a title, a status, a due date and a description. Neither the
        list nor the form is written by hand — both are <strong>screens</strong>,
        and the tasks are saved in an ordinary <code>tasks</code> table with one
        column per field.
      </p>

      <h3>Change it</h3>
      <p>
        Open <strong>Forms</strong> in the side rail and{' '}
        <strong>Design form</strong> on Tasks. Add a field, move one, change a
        label or a colour — then <strong>Publish</strong>. The table gains its
        new column as you publish.
      </p>

      <h3>Ask Claude for one</h3>
      <p>In this project, give Claude a prompt like:</p>
      <pre className="app-help-prompt">{PROMPT}</pre>
      <p>
        It follows <code>CLAUDE.md</code> — the screens, the page with its hooks,
        the server hooks and model, the menu entry — and the API creates the table.
      </p>

      <h3>Or by hand</h3>
      <p>
        <strong>Forms → New form</strong>: name it, design it, publish it, open
        it — no code. The full steps for a form with its own page, hooks and
        model are in <code>CLAUDE.md</code>, under "Create a new UI".
      </p>

      <h3>More than saving</h3>
      <p>
        In the browser — a value added before saving, rows filtered for display,
        an extra button on each row: <code>ui/src/pages/EditTask.jsx</code>.
        Every method calls <code>super</code>; change the one you need.
      </p>
      <p>
        On the server — a check against other records, an email afterwards, a
        list only managers see: <code>api/screens/task/task.hooks.js</code>.
      </p>

      <h3>Two things that catch people</h3>
      <ul className="app-help-notes">
        <li>
          Once a screen is published, the <em>database</em> holds its design.
          Editing its <code>.screen.json</code> afterwards changes nothing — use
          Forms.
        </li>
        <li>
          A new menu entry is remembered for ten minutes. Restart the sign-in
          service if you want it immediately.
        </li>
      </ul>
    </aside>
  )
}
