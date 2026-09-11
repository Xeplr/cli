var { BaseModel } = require('@xeplr/db');

/**
 * A task. The sample model — deliberately small, and deliberately showing the
 * three things almost every real model needs: required fields, a value
 * restricted to a known set, and a date.
 *
 * `jsonSchema` is not decoration. It is checked on every insert and update, so
 * a bad value is refused by the API with a message naming the field, rather
 * than reaching the database and failing as a constraint error nobody can read.
 */
class Task extends BaseModel {
  static get tableName() { return 'tasks'; }
  static get idColumn() { return 'id'; }

  // Rows are NOT scoped to a company/workspace here, because this app has not
  // declared any tenancy levels. Leave it as the default (true) and add
  // registerMTs() later, and every row written before that has no owner.
  static get multiTenant() { return false; }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['title'],
      properties: {
        // 25 characters, because that is what the framework's own id generator
        // produces (see genericController — ids are minted there, not here).
        id: { type: 'string', maxLength: 25 },
        title: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: ['string', 'null'], maxLength: 1000 },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
        dueDate: { type: ['string', 'null'] },
        isActive: { type: 'boolean' },
        recordCreatedDate: { type: ['string', 'null'] },
        recordModifiedDate: { type: ['string', 'null'] },
        recordCreatedBy: { type: ['string', 'null'], maxLength: 25 },
        recordModifiedBy: { type: ['string', 'null'], maxLength: 25 }
      }
    };
  }

  $beforeInsert() {
    super.$beforeInsert();   // keeps recordCreatedDate / isActive handling
    if (!this.status) this.status = 'todo';
  }
}

module.exports = Task;
