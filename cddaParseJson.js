/***
Github: https://github.com/ampersand55/cddaParseJson/
Usage: node cddaParseJson.js <json file or path>
Make changes in the switch statement in function parseJsonItem
 ***/

const SETTINGS = {
  // testRun: true, //  if set to true json-files are not updated
  writeLog: true, // if true a logToFile is written
  // logFileName: 'log_' + new Date().toISOString().replace(/:/g, '-') + '.log', // log_YYYY-MM-DDTHH:mm:ss.sssZ.log
  logFileName: 'log.log',
  filePadEnd: 60,
  itemIdPadEnd: 35,
  linter: 'json_formatter.exe',
};

function parseJsonItem(item, nfo, o) {

  const pairs = Object.entries(item)
    .map(([key, value]) => { // create a dictionary-like array of key-value pairs

      /***
      item                current object being parsed.
      key                 name of the <key> of the <item>
      value               the <value> associated with the <key> of the <item>
      nfo                 an object used for filtering items to change.
      --nfo.id            the value of the "id" or "abstract" key of the top-level item being parsed (if has one).
      --nfo.isToplevel    true if the <item> is the is the base cdda item being parsed.
      --nfo.parent        the most recent parent key of this <item>, null if this is a base cdda item.
      --nfo.ancestors     an array of all parent keys of current object being parsed.
      --nfo.depth         number of ancestors of current object being parsed.
      o                   an object containing misc stuff mostly used in other places. Included here for logging.

      logSkip(ch, value, comment)     used to log skipping a change of a <value> for some reason (comment).
      changeValue(ch, value, comment) used to change a value and log a the change.
      --ch                            used for logging, don't touch.
      --value                         the new value this is being changed to.
      --comment (optional)            used to give a comment or reason for the change in <value> in the log.
       ***/

      if (nfo.isTopLevel)
        nfo.id = item.id || item.abstract || ''; // set top-level id to all decending nfo objects
      const ch = { // object used for logging
        key,
        value,
        origValue: value,
        nfo,
        o,
        item
      }; 
      switch (key) { // make all changes here;
      case 'storage':
      case 'contains':
      case 'min_volume':
      case 'max_volume':
      case 'min_pet_volume':
      case 'integral_volume':
      case 'volume':
        if (isInt(value) && value !== 0) {
          if (item.type === 'speech') { // for speech items volume means sound volume
            break;
          }
          if (['musical_instrument', 'furniture'].includes(item.type)) { // here volume means sound volume
            logSkip(ch, 'item type ' + item.type);
            break;
          }
          if (!nfo.isTopLevel && !['use_action', 'workbench', 'container_data', 'armor_data'].includes(nfo.parent)) {
            //disallow all non-toplevel objects except these
            logSkip(ch, 'child of ' + nfo.parent);
            break;
          }

          const liters = Number(value) / 4;
          let volumeStr = '';
          if (isInt(liters))
            volumeStr = String(liters) + ' L';
          else
            volumeStr = String(liters * 1000) + ' ml';

          changeValue(ch, volumeStr, 'setting to metric string');
        }
        // else if (isStr(value)) {
        // const[, volume, spacing, unit] = value.match(/(\d+)(\s*)(\w+)/);
        // if (spacing.length !== 1)
        // changeValue(ch, volume + ' ' + unit, 'fix spacing');
        // }
        break;
      default:
        break;
      }

      // recursively handle nested objects and arrays
      if (isArr(ch.value)) {
        ch.value = ch.value
          .map(e => {
            if (isObj(e))
              return parseJsonItem(e, newInfo(nfo, ch.key, e), o);
            else
              return e;
          });
      } else if (isObj(ch.value)) {
        ch.value = parseJsonItem(value, newInfo(nfo, ch.key, ch.value), o);
      }

      return [ch.key, ch.value];
    })
    stats.totalObjects++;
  return Object.fromEntries(pairs); // merges the key-value pairs into an object to be converted into a JSON.
}

if (!Object.fromEntries) {
  // polyfill until nodejs supports ECMAScript 2019
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries
  Object.fromEntries = arr => arr.reduce((acc, cur) => {
      acc[cur[0]] = cur[1];
      return acc;
    }, {});
}

const FS = require('fs');
const PATH = require('path');
const spawn = require('child_process').spawn;
const afs = require('./h/afs.js');
const parseArgs = require('./h/parseArgs.js');
const {
  c,
  log,
  cloneObject,
  throwError,
  sleep
} = require('./h/utils.js');
const {
  isBool,
  isStr,
  isInt,
  isFloat,
  isArr,
  isObj,
  isEqual,
  isDir,
  isFile,
  exists
} = require('./h/is.js');

const arg = parseArgs();
const basePath = PATH.parse(arg).dir;

if (!exists(SETTINGS.linter)) {
  throw new Error('Linter not found: ' + SETTINGS.linter);
}

const stats = {
  filesParsed: 0,
  jsonEntries: 0,
  totalObjects: 0,
  totalObjectsChanged: 0,
  startFileBytes: 0,
  endFileBytes: 0,
  startJsonBytes: 0,
  endJsonBytes: 0,
  totalChange: 0,
  filesChanged: 0,
  changes: [],
};

// script starts here

afs.getFiles(arg, filter).catch(throwError)
.then(readJsons).catch(throwError)
// .then(sortJsons).catch(throwError)
.then(updateJsons).catch(throwError)
.then(saveJsons).catch(throwError)
.then(lintJsons).catch(throwError)
.then(savelogToFile).catch(throwError);

// script ends here

function filter(path) {
  return isDir(path) || path.endsWith('.json');
}
function readJsons(files) {
  log.bcyan('reading files and parsing json...');
  stats.filesParsed = files.length;
  return Promise.all(files.map(readJsonFile));
}

async function readJsonFile(file) {
  const json = await afs.readFile(file).then(JSON.parse);

  if (isArr(json)) {
    stats.jsonEntries += Object.keys(json).length;
  } else if (isObj(json)) {
    stats.jsonEntries++;
  }

  const s = FS.statSync(file);
  stats.startFileBytes += s.size;
  stats.startJsonBytes += JSON.stringify(json).length;

  return {
    base: file.replace(basePath, ''),
    file,
    json
  };
}
function makeLog(ch, comment, logFormat) {

  let logToScreen = '';
  let logToFile = '';

  if (logFormat === 'change') {
    if (ch.value === ch.origValue)
      throw new Error('No changes made in value ' + ch.value);
    logToScreen += c.green;
  } else if (logFormat === 'skip') {
    logToScreen += c.yellow;
  }

  let keyName = ch.nfo.id || '';
  if (ch.nfo.ancestors.length)
    keyName += ' > ' + ch.nfo.ancestors.join(' > ');
  if (comment)
    comment = ' (' + comment + ')';

  let cFile = ch.o.base.padEnd(SETTINGS.filePadEnd);
  let cItemId = keyName.padEnd(SETTINGS.itemIdPadEnd);
  let cKey = ch.key;

  logToScreen += cFile +
  c.reset + cItemId +
  c.cyan + ch.key + c.reset +
  ' : ' + c.yellow + ch.origValue + c.reset;

  logToFile += cFile +
  cItemId +
  ch.key +
  ' : ' + ch.origValue;

  if (logFormat === 'skip') {
    logToScreen += ' skipped';
    logToFile += ' skipped';
  } else if (logFormat === 'change') {
    logToScreen += ' > ' + c.green + ch.value;
    logToFile += ' > ' + ch.value;
    stats.totalObjectsChanged++;
  }

  logToFile += comment;
  logToScreen += c.reset + comment;

  log(logToScreen);

  stats.changes.push(logToFile);
}

function changeValue(ch, value, comment = '') {
  ch.o.isChanged = true;
  ch.value = value;
  makeLog(ch, comment, 'change');
}
function logSkip(ch, comment = '') {
  makeLog(ch, comment, 'skip');
}

function newInfo(nfo, key, value) {
  f = cloneObject(nfo);
  f.isTopLevel = false;
  f.depth++;
  f.parent = key;
  if (!f.ancestors.includes(key)) {
    f.ancestors.unshift(key);
  }
  return f;
}
const keysToPutFirst = ['abstract', 'id', 'id_suffix', 'name', 'name_plural', 'type'].reverse();
const keysToPutLast = [];

function sortKeys(a, b) {
  let ret = 0;
  keysToPutFirst.forEach(key => {
    if (key === a[0]) {
      ret = -1;
      return
    } else if (key === b[0]) {
      ret = 1;
      return
    }
  });
  return ret;
}
function sortJsons(arr) {
  return arr.map(o => {
    if (isArr(o.json)) {
      o.json = o.json.map(item => {
          const pairs = Object.entries(item).sort(sortKeys);
          return Object.fromEntries(pairs);
        });
    } else if (isObj(o.json)) {
      const pairs = Object.entries(o.json).sort(sortKeys);
      o.json = Object.fromEntries(pairs);
    }
    return o;
  });
}
async function updateJson(o) {
  const baseNfo = {
    depth: 0,
    isTopLevel: true,
    parent: null,
    ancestors: [],
    comments: []
  };
  if (isArr(o.json)) {
    o.orig = cloneObject(o.json);
    o.json = o.json.map(item => parseJsonItem(item, baseNfo, o));

  } else if (isObj(o.json)) {
    o.orig = cloneObject(o.json);
    o.json = parseJsonItem(o.json, baseNfo, o)
  } else {
    log.red('error', o.json);
  }
  return o;
}
function updateJsons(arr) {
  log.bcyan('updating jsons...');
  log.white('FILE'.padEnd(SETTINGS.filePadEnd) + 'ITEM ID'.padEnd(SETTINGS.itemIdPadEnd) + 'CHANGE');
  return Promise.all(arr.map(o => updateJson(o)));
}
function saveJsons(arr) {
  log.bcyan('saving changes...');
  arr.forEach(o => {
    const jsonStr = JSON.stringify(o.json);
    stats.endJsonBytes += jsonStr.length;
    if (isEqual(o.json, o.orig) || SETTINGS.testRun)
      return;

    afs.writeFile(o.file, jsonStr);
  });
  return arr;
}
function lintJsons(arr) {
  log.bcyan('linting files...');
  if (SETTINGS.testRun)
    return arr;
  return Promise.all(arr.map(lintFile));
}
async function lintFile(o) {
  if (!o.isChanged)
    return o;
  await sleep(100); // sometimes file with updated json has not written yet.
  const process = spawn(SETTINGS.linter, [o.file]);
  // process.on('close', (exitCode) => {
  // if (exitCode === 1) {
  // log.green(o.file, 'was updated and linted');
  // }
  // });
  process.on('error', (err) => {
    throw err;
  });
  await sleep(100); // sometimes needed for FS.statSync.
  return o;
}
async function savelogToFile(arr) {
  log.bcyan('saving log file: ' + SETTINGS.logFileName);
  arr.forEach(o => {
    stats.endFileBytes += FS.statSync(o.file).size;
    if (o.isChanged)
      stats.filesChanged++;
  })

  let logStr = '';
  logStr += 'directory or file parsed  : ' + arg + '\n';
  logStr += 'files parsed              : ' + stats.filesParsed + '\n';
  logStr += 'items (jsonEntries) found : ' + stats.jsonEntries + '\n';
  logStr += 'objects found             : ' + stats.totalObjects + '\n';
  logStr += 'objects changed           : ' + stats.totalObjectsChanged + '\n';
  logStr += 'json characters start     : ' + stats.startJsonBytes + '\n';
  logStr += 'json characters end       : ' + stats.endJsonBytes + '\n';
  logStr += 'json characters changed   : ' + (stats.endJsonBytes - stats.startJsonBytes) + '\n';
  if (!SETTINGS.testRun) {
    logStr += 'file-size start           : ' + stats.startFileBytes + '\n';
    logStr += 'file-size end             : ' + stats.endFileBytes + '\n';
    logStr += 'file-size changed         : ' + (stats.endFileBytes - stats.startFileBytes) + '\n';
    logStr += 'files changed             : ' + stats.filesChanged + '\n';
  }
  await sleep(100);
  log('\n' + logStr);

  if (stats.changes.length) {
    logStr += '\nCHANGES:\n\n';
    logStr += 'FILE'.padEnd(SETTINGS.filePadEnd) + 'ITEM ID'.padEnd(SETTINGS.itemIdPadEnd) + 'CHANGE\n\n';
    stats.changes.forEach(change => logStr += change + '\n');
  } else {
    logStr += '\nNo files changed.'
  }

  if (SETTINGS.writeLog && !SETTINGS.testRun) {
    const logToFile = SETTINGS.logFileName;
    afs.writeFile(logToFile, logStr.replace(/\u001b..../g, ''));
  }

  return arr;
}
