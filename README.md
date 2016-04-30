# npm-pkg-dl

Download a package like npm and make it available into a temporary folder.

# Install

```sh
npm i @mh-cbon/npm-pkg-dl -g
```

# Usage

```sh
npm-dl <package source> <-d|--dir target-path> <-r|--registry https://registry.url/>

npm-dl [<@scope>/]<name>
npm-dl [<@scope>/]<name>@<tag>
npm-dl [<@scope>/]<name>@<version>
npm-dl [<@scope>/]<name>@<version range>
npm-dl <tarball file>
npm-dl <tarball url>
npm-dl <folder>
```

# Api

```js
var npmPkgDl = require('@mh-cbon/npm-pkg-dl');

npmPkgDl('package source', {
  dir: "target directory", // or null for a temp directory
  registry: "the registry url"
}, function (err, dirPath) {
  err && console.error(err);
  console.log(dirPath);
})

```

# Examples

```sh
$ node bin.js git://github.com/mh-cbon/cors-proxy.git -d some
some

$ node bin.js minimist@">0.0.5" -d some
some/package

$ node bin.js @mh-cbon/cors-proxy -d some
some/package

$ node bin.js github:mh-cbon/cors-proxy -d some
some/package

$ node bin.js mh-cbon/cors-proxy -d some
some/package

$ node bin.js https://github.com/mh-cbon/cors-proxy/archive/v1.0.1.zip -d some
some/cors-proxy-1.0.1

$ node bin.js https://github.com/mh-cbon/cors-proxy/archive/v1.0.1.tar.gz -d some
some/cors-proxy-1.0.1

$ node bin.js https://registry.npmjs.org/@mh-cbon/aghfabsowecwn/-/aghfabsowecwn-2.0.0.tgz -d some
some/package
```

# Read more

- https://docs.npmjs.com/cli/install
