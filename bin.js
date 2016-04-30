#!/usr/bin/env node

var npmPkgDl = require('./index.js')

var argv = require('minimist')(process.argv.slice(2));

if (!argv._[0]) {
  console.log("Wrong usage")
  console.log("Usage :")
  console.log("npm-pkg-dl <package>")
  console.log("npm-pkg-dl <package@version>")
  console.log("npm-pkg-dl <@scope/package>")
  console.log("npm-pkg-dl <@scope/package@version>")
  console.log("npm-pkg-dl <tarball url (zip|tar|tgz)>")
  console.log("npm-pkg-dl <folder path>")
  process.exit(1)
}

npmPkgDl(argv._[0], {
  dir: argv.dir || argv.d || null,
  registry: argv.regisry || argv.r || null
}, function (err, dirPath) {
  err && console.error(err);
  console.log(dirPath);
})
