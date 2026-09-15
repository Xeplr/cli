// The panel beside the sample. It is here so the first thing anybody builds is
// explained where they are looking, rather than in a document they have to go
// and find.
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
        Open <strong>Forms</strong> in the side rail and <strong>Design form</strong>
        on Tasks. Add a field, move one, change a label or a colour — then
        <strong> Publish</strong>. The table gains its new column as you publish.
      </p>

      <h3>Add your own</h3>
      <p>
        <strong>Forms → New form</strong>: name it, design it, publish it, open it.
        Or have Claude write one:
      </p>
      <ol className="app-help-steps">
        <li>
          <strong>Describe it</strong>
          <code>api/screens/project/project.entity.json</code>
          <span>Its name and fields — copy <code>task/task.entity.json</code>.</span>
        </li>
        <li>
          <strong>Make its screens</strong>
          <code>npx xeplr-factory screens screens/project/project.entity.json -o screens/project</code>
          <span>From the api folder. Then list them in <code>api/screens/index.js</code>.</span>
        </li>
        <li>
          <strong>The page</strong>
          <code>ui/src/pages/Projects.jsx</code>
          <span>Copy <code>Tasks.jsx</code> and load <code>project_list</code>.</span>
        </li>
        <li>
          <strong>The menu entry</strong>
          <code>api/migrations-auth/000N_projects_menu.sql</code>
          <span>
            The side-rail item appears only if its name exists in the database,
            spelled exactly the same.
          </span>
        </li>
      </ol>
      <p>Restart the API and the new table is created for you.</p>

      <h3>More than saving</h3>
      <p>
        A value worked out on save, an email afterwards, a list only managers
        see: <code>api/screens/task/task.hooks.js</code> — before, after, error
        and override, for save, get and delete.
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
