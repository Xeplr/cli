// THE SCREENS THIS APP SHIPS WITH — designed with @xeplr/ui-factory.
//
// Each entity is two screens: a list, and the add / edit form the list opens
// in a popup. Their records live in a REAL table named for the entity
// ("tasks"), one column per field.
//
// On startup (bin/www) every screen here that has never been published is
// published — which creates its table. After that the DATABASE holds the
// design: change it in the app's Designer page, where Publish changes the
// table to match. Editing a .screen.json later changes nothing for an
// already-published screen.
//
// ADD AN ENTITY:
//
//   npx xeplr-factory screens screens/project/project.entity.json -o screens/project
//
// then list its two screens and its hooks below, and add a page and a menu
// entry for it (see the UI's src/pages/Tasks.jsx and migrations-auth/).

module.exports = {
  // Publish order is worked out for you: a table before the dropdowns that
  // point at it, lists last.
  documents: [
    require('./task/task-edit.screen.json'),
    require('./task/task-list.screen.json')
  ],

  // Your own code around save / get / delete, per screen — see task/task.hooks.js.
  hooks: {
    task_edit: require('./task/task.hooks')
  }
};
