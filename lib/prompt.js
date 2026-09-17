// Asking questions on a terminal, with nothing installed.
//
// NO DEPENDENCIES, deliberately. This is the first thing anybody runs, usually
// through `npx`, and every package it pulls is time spent before the first
// question and one more thing that can fail on a machine we have never seen.
// readline has been in Node since forever and does everything needed here.
var readline = require('readline');

/**
 * WHY THIS QUEUES LINES INSTEAD OF CALLING rl.question() PER ANSWER.
 *
 * rl.question() registers a ONE-SHOT listener. On a terminal that is fine,
 * because a human cannot type faster than we can re-register it. Piped input
 * is not: readline reads the whole chunk and emits every 'line' synchronously,
 * so each answer after the first arrives while no question is pending and is
 * DROPPED ON THE FLOOR. The next question then waits for input that has
 * already been and gone, and the process exits mid-wizard having silently
 * discarded most of what it was given.
 *
 * So we listen for 'line' permanently and keep what arrives. A question takes
 * the next queued line if one is waiting, or waits for the next one. Identical
 * behaviour typed or piped — which matters, because piping answers is how this
 * gets tested and how anybody scripts it.
 */
function createSession(options) {
  options = options || {};
  var input = options.input || process.stdin;
  var output = options.output || process.stdout;

  var rl = readline.createInterface({ input: input, output: output });

  var queued = [];      // lines that arrived before anything asked for them
  var waiting = [];     // resolvers waiting for a line that has not arrived
  var closed = false;

  rl.on('line', function (line) {
    if (waiting.length) return waiting.shift()(line);
    queued.push(line);
  });

  rl.on('close', function () {
    closed = true;
    // Anything still waiting gets an empty string, so its default applies and
    // the caller ends cleanly rather than hanging on a stream that is finished.
    while (waiting.length) waiting.shift()('');
  });

  function nextLine() {
    if (queued.length) return Promise.resolve(queued.shift());
    if (closed) return Promise.resolve('');
    return new Promise(function (resolve) { waiting.push(resolve); });
  }

  /**
   * @param {string} question
   * @param {object} [opts]
   * @param {string} [opts.default]  shown in brackets; returned on empty input
   * @param {Function} [opts.validate] (value) => true | 'why it is wrong'
   */
  async function ask(question, opts) {
    opts = opts || {};
    var suffix = opts.default ? ' (' + opts.default + ')' : '';

    for (;;) {
      output.write(question + suffix + ' ');
      var answer = await nextLine();
      var value = (answer || '').trim() || opts.default || '';

      if (!opts.validate) return value;

      var verdict = opts.validate(value);
      if (verdict === true) return value;

      // Re-ask rather than exit. Being thrown out of a wizard on the fourth
      // question because of a typo means starting over.
      output.write('  ' + verdict + '\n');

      // ...unless there is no more input to re-ask with. Piped or redirected
      // input would otherwise loop forever printing the same complaint.
      if (closed && !queued.length) {
        throw new Error(question + ' — ' + verdict);
      }
    }
  }

  /**
   * Like ask(), but the typing does not appear on screen.
   *
   * Only when the input is a real terminal. Piped input has no echo to
   * suppress, and trying to mute it there breaks reading altogether — which
   * would make the one thing nobody can retype impossible to script.
   */
  async function askSecret(question) {
    if (!input.isTTY) return ask(question);

    output.write(question + ' ');
    var muted = true;
    var onData = function (char) {
      // Stop hiding once the line ends, so the next prompt is visible.
      if (char.toString() === '\n' || char.toString() === '\r') muted = false;
    };
    input.on('data', onData);

    var originalWrite = output.write.bind(output);
    output.write = function (chunk) {
      if (muted) return true;          // swallow the echo
      return originalWrite(chunk);
    };

    try {
      var value = await nextLine();
      return (value || '').trim();
    } finally {
      output.write = originalWrite;
      input.removeListener('data', onData);
      originalWrite('\n');
    }
  }

  async function confirm(question, defaultYes) {
    var v = await ask(question + (defaultYes ? ' [Y/n]' : ' [y/N]'), {
      default: defaultYes ? 'y' : 'n'
    });
    return /^y/i.test(v);
  }

  /** A line of explanation between questions — no answer expected. */
  function say(text) { output.write(text + '\n'); }

  return { ask: ask, askSecret: askSecret, confirm: confirm, say: say, close: function () { rl.close(); } };
}

module.exports = { createSession: createSession };
