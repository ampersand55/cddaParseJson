if (process.versions.node.split('.')[0] < 10) {
  console.log('requires Nodejs v10+');
  console.log('current version is:',process.versions.node);
  process.exit(0);
}
const FS = require('fs');
const FSP = FS.promises;
const resolve = require('path').resolve;

const readdirOptions = {
  withFileTypes: true
};

async function getFiles(baseDir, filter, verbose = false) {
  
  if (FS.existsSync(baseDir) && FS.statSync(baseDir).isFile()) {
    return [resolve(baseDir)];
  }
  let dirents = await FSP.readdir(baseDir, readdirOptions);
  if (filter) {
    dirents = dirents.filter(d => filter(resolve(baseDir, d.name)));
  }
  const files = await Promise.all(dirents.map(async d => {
        const path = resolve(baseDir, d.name);
        if (verbose)
          console.log('parsing', path);
        if (d.isDirectory())
          return getFiles(path, filter, verbose);
        else if (d.isFile())
          return path;
        else
          throw new Error(path + ' is not file or dir');
      }));
  return files.flat();
}
async function readFile(path, options = 'utf8') {
  const data = await FSP.readFile(path, options);
  return data;
}
async function writeFile(path, data, options = 'utf8') {
  await FSP.writeFile(path, data, options);
}

module.exports = {
  getFiles,
  readFile,
  writeFile
};
