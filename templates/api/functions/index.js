// THIS APP'S FUNCTIONS — everything a screen DOES: its buttons, the lists it
// works out, its rules on save, a flow's "let a function decide". Loaded once
// at startup (bin/www), before the screens — restart the API after adding one.
//
// A function is registered under the EVENT it is written for, and picked BY
// NAME from a dropdown in the designer, which offers each place only the
// functions written for it. The designer only ever sees the name, the
// description and what the event hands it — the code stays here, and runs on
// the server. BUILDING.md, at the project's root, has a recipe for each.
//
// The screen's own events — picked in Configure UI → Flows → a step → Events
// & navigation (or a screen's `events` in its .screen.json):
//
//   event          runs                                   ctx adds              return
//   beforeLoad     before records are read                query (narrow it)     nothing, or a new query
//   beforeSave     before a record is written             values, isNew,        the values to save
//                                                         previous
//   afterSave      once it is saved                       result                (ignored)
//   beforeDelete   before a delete                        previous              nothing
//   onError        when load / save / delete failed       error                 (ignored)
//   decide         a flow step is done: where next?       values, targets       a step key
//
// A screen's controls — picked on the control, in Configure UI → Forms → Design:
//
//   event          picked at                              ctx adds              return
//   button         Buttons → a button → Runs              ({ input, system }):  { message }
//                                                         input = its values,
//                                                         system.record / id
//   buttonOptions  a button's popup → a checklist         record, id, field     [{ id, label }]
//                  → Entries from
//   listRows       List → Rows from                       query { q, filter,    { rows, counts, kpis }
//                                                         kpi, from, to }
//   rowDetails     List → a column → Hover box from       id, column            [{ text, sub, at }]
//   recordDetails  Details → Details from                 record, id            { sections }
//   feedEntries    Comments & history → Entries from      record, id            [{ id, kind, text }]
//   suggest        Autocomplete → Suggestions from        query { q }           [{ value, label }]
//
// Every ctx has user, access ({ roles }), tenant, knex, db() (a table, this
// company's active rows) and reject(message, { field }) — which refuses with
// the message on that field.
//
// A screen that names a function nobody registered is refused when it is
// published, by name — so renaming one here means renaming it there too.
// Add files beside this one and require them below as the app grows.
var { register } = require('@xeplr/actions');

register({
  name: 'tidyTaskTitle',
  event: 'beforeSave',
  description: 'Trims a task\'s title and squeezes repeated spaces, so "  Plant   seeds " is saved as "Plant seeds".',
  execute: function(ctx) {
    var title = String(ctx.values.title || '').replace(/\s+/g, ' ').trim();
    if (!title) ctx.reject('A task needs a title', { field: 'title' });
    return Object.assign({}, ctx.values, { title: title });
  }
});

register({
  name: 'byPriority',
  event: 'decide',
  description: 'High-priority tasks go to the first screen it may choose; everything else to the second.',
  execute: function(ctx) {
    // ctx.targets: the steps ticked under "It may choose", in the flow's order.
    var high = ctx.values && ctx.values.priority === 'high';
    return high ? ctx.targets[0] : (ctx.targets[1] || ctx.targets[0]);
  }
});
