// The panel beside the sample form. It is here so the first thing anybody
// builds is explained where they are looking, rather than in a document they
// have to go and find.
export default function TasksHelp() {
  return (
    <aside className="app-help">
      <div className="app-help-badge">Sample</div>
      <h2>This page is an example</h2>
      <p>
        A task has a title, a description, a status and a due date. Nothing here
        is special — it is the same five pieces you will write for anything your
        app stores. Delete it once you have your own.
      </p>

      <h3>Add your own, in five pieces</h3>
      <ol className="app-help-steps">
        <li>
          <strong>The table</strong>
          <code>api/migrations/0002_things.sql</code>
          <span>Runs by itself when the API next starts.</span>
        </li>
        <li>
          <strong>The model</strong>
          <code>api/models/Thing.js</code>
          <span>
            Names the table and lists the fields, with the rules for each. Those
            rules are checked on every save.
          </span>
        </li>
        <li>
          <strong>The routes</strong>
          <code>api/routes/index.js</code>
          <span>
            One line — hand the model to <code>genericRoute</code> and you get
            list, fetch, save and delete. You write none of them.
          </span>
        </li>
        <li>
          <strong>The page</strong>
          <code>ui/src/pages/Things.jsx</code>
          <span>
            Plus a file for the calls and one for the form's behaviour, so a new
            look means replacing the page only.
          </span>
        </li>
        <li>
          <strong>The menu entry</strong>
          <code>api/migrations-auth/000N_things_menu.sql</code>
          <span>
            The side-rail item appears only if its name exists in the database,
            spelled exactly the same.
          </span>
        </li>
      </ol>

      <h3>Two things that catch people</h3>
      <ul className="app-help-notes">
        <li>
          Keep every data address under <code>/api</code>. Serve data at{' '}
          <code>/things</code> and it hides the <em>page</em> at the same
          address — you get raw data instead of your app.
        </li>
        <li>
          A new menu entry is remembered for ten minutes. Restart the sign-in
          service if you want it immediately.
        </li>
      </ul>
    </aside>
  )
}
