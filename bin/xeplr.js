#!/usr/bin/env node

var path = require('path');
var prompt = require('../lib/prompt');
var questions = require('../lib/questions');
var plan = require('../lib/plan');
var generate = require('../lib/generate');
var nextSteps = require('../lib/nextSteps');
var encryptCmd = require('../lib/commands/encrypt');

var HELP = [
  '',
  '  xeplr — create a working xeplr application',
  '',
  '  Usage:',
  '    xeplr new [name]     create a project',
  '    xeplr encrypt        redo the database connection',
  '',
  '  new      Creates a project with an API, sign-in and a UI, all talking',
  '           to each other. Asks a few questions; generates the rest.',
  '',
  '  encrypt  Turns database details into the single string the settings',
  '           file holds. Run it inside a project and it finds the key and',
  '           writes the result in for you. For when a password changes, the',
  '           database moves, or the first answer was wrong.',
  ''
].join('\n');

async function main() {
  var argv = process.argv.slice(2);
  var command = argv[0];

  if (!command || command === '-h' || command === '--help' || command === 'help') {
    console.log(HELP);
    return 0;
  }
  if (command === 'encrypt') {
    var s2 = prompt.createSession();
    try {
      return await encryptCmd.run(s2, argv.slice(1));
    } finally {
      s2.close();
    }
  }

  if (command !== 'new') {
    console.error('\n  Unknown command: ' + command + '\n  Try: xeplr new <name>  or  xeplr encrypt\n');
    return 1;
  }

  console.log('\n  Creating a xeplr application.\n');

  var session = prompt.createSession();
  try {
    var answers = await questions.collect(session, argv[1]);
    console.log(plan.describe(answers));

    var go = await session.confirm('  Create it?', true);
    if (!go) {
      console.log('\n  Nothing was written.\n');
      return 0;
    }
  } finally {
    session.close();
  }

  var target = path.resolve(process.cwd(), answers.name);
  var result = generate.generate(answers, target);
  console.log('\n  Wrote ' + result.written.length + ' files.');
  console.log(nextSteps.describe(answers, target));
  return 0;
}

main().then(function (code) { process.exit(code); }, function (err) {
  console.error('\n  ' + (err && err.message ? err.message : err) + '\n');
  process.exit(1);
});
