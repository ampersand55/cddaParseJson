const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgblack: '\x1b[40m',
  bgred: '\x1b[41m',
  bggreen: '\x1b[42m',
  bgyellow: '\x1b[43m',
  bgblue: '\x1b[44m',
  bgmagenta: '\x1b[45m',
  bgcyan: '\x1b[46m',
  bgwhite: '\x1b[47m',
}

function makeLogger(fg = c.reset, bg = '') {
  return (...args) => console.log(fg + bg, ...args, c.reset);
}
const log = makeLogger(c.reset);

Object.keys(c).forEach(color => {
  log[color] = makeLogger(c[color]);
  log['b' + color] = makeLogger(c.bright + c[color]);
});

log.warn = (...args) => makeLogger(c['white'], c['bgred'])(args.join(' ').padEnd(process.stdout.columns - 3));
log.invert = (...args) => makeLogger(c['black'], c['bgwhite'])(args.join(' ').padEnd(process.stdout.columns - 3));
log.hgreen = (...args) => makeLogger(c['white'], c['bggreen'])(args.join(' ').padEnd(process.stdout.columns - 3));
log.hyellow = (...args) => makeLogger(c['white'], c['bgyellow'])(args.join(' ').padEnd(process.stdout.columns - 3));
log.hblue = (...args) => makeLogger(c['white'], c['bgblue'])(args.join(' ').padEnd(process.stdout.columns - 3));
log.hmagenda = (...args) => makeLogger(c['white'], c['bgmagenda'])(args.join(' ').padEnd(process.stdout.columns - 3));
log.hcyan = (...args) => makeLogger(c['white'], c['bgcyan'])(args.join(' ').padEnd(process.stdout.columns - 3));

function cloneObject(obj) {
  //doesn't handle circular structures recursion or special objects like dates.
  if (obj === null || obj === undefined || typeof obj !== 'object')
    return obj;

  if (Array.isArray(obj))
    return obj.map(el => cloneObject(el));

  if (obj instanceof Object) {
    const copy = {};
    Object.entries(obj).forEach(([k, v]) => copy[k] = cloneObject(v));
    return copy;
  }
  throw new Error('Unable to copy object');
}
function throwError(e) {
  log.warn(...arguments);
  throw e;
}
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  });
}

module.exports = {
  c,
  log,
  makeLogger,
  cloneObject,
  throwError,
  sleep
};
