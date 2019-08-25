const FS = require('fs');
const resolve = require('path').resolve;
module.exports = function parseArgs() {
  if (process.argv.length !== 3) {
    console.log('must have exactly one argument');
    console.log('usage: "' + process.argv[0] + '" "' + process.argv[1] + '" <.json file or root directory>');
    process.exit(0);
  }

  if (!FS.existsSync(process.argv[2])) {
    console.log('path not found:', process.argv[2]);
    process.exit(0);
  }
  return resolve(process.argv[2]);
}
