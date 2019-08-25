const FS = require('fs');
const isBool = o => typeof o === 'boolean';
const isStr = o => typeof o === 'string';
const isInt = Number.isInteger.bind(Number);
const isFloat = (number) => Number.isFinite(number) && !Number.isInteger(number);
const isArr = Array.isArray.bind(Array);
const isObj = o => o !== null && o.constructor && o.constructor.name === 'Object';
const isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const exists = FS.existsSync.bind(FS);
const isDir = path => FS.statSync(path).isDirectory();
const isFile = path => FS.statSync(path).isFile();

module.exports = {
  isBool,
  isStr,
  isInt,
  isFloat,
  isArr,
  isObj,
  isEqual,
  exists,
  isDir,
  isFile
};
