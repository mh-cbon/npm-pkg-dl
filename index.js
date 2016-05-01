var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var yauzl = require('yauzl');
var mkdirp = require('mkdirp');
var tar = require('tar');
var zlib = require('zlib');
var hyperquest = require('hyperdirect')(10);
var temp = require('temp');
var semver = require('semver');
var pkgJ = require('./package.json')
var debug = require('debug')(pkgJ.name);
// temp.track();

var finalDir = function (opts, then) {
  if (opts.dir) {
    return mkdirp(opts.dir, function (err) {
      if (err) return then(err);
      return then(null, opts.dir);
    })
  }
  temp.mkdir('s', then);
}

var npmPkgDl = function (what, opts, then) {
  debug('opts=%j', opts)
  fs.access(path.join(what, 'package.json'), fs.F_OK, function (err) {
    if (!err) debug('is a folder %s', what)
    if (!err) return then(undefined, path.normalize(what)); // a folder was provided
    if(what.match(/^https?:\/\//)) {
     debug('is a tarball url %s', what)
     tarballDl(what, opts, then)
    } else if(what.match(/^git(\+(ssh|http|https|file))?:\/\//)) {
      debug('is a git %s', what)
      gitDl(what, opts, then);
    } else if (what.match(/^[^@][^\/]+\/.+/)
      || what.match(/^(github|bitbucket|gist|gitlab):/)) {
      debug('is a git http %s', what)
      gitHttpDl(what, opts, then);
    } else {
      debug('is an npm package %s', what)
      npmDl(what, opts, then)
    }
  })
}

module.exports = npmPkgDl;

var gitHttpDl = function (what, opts, then) {
  var gitUrl = '';
  var repo = '';
  var provider = what.match(/^(github|bitbucket|gist|gitlab):/) && what.match(/^(github|bitbucket|gist|gitlab):/)[1];
  what = what.replace(/^(github|bitbucket|gist|gitlab):/, '')
  if (!provider) {
    gitUrl = 'https://github.com/' + what;
    repo = what.match(/^([^\/]+)/)[1]
  } else if (provider.match(/github/)) {
    gitUrl = 'https://github.com/' + what;
    repo = what.match(/^([^\/]+)/)[1]
  }
  else if (provider.match(/bitbucket/)) {
    gitUrl = 'https://bitbucket.org/' + what;
    repo = what.match(/^([^\/]+)/)[1]
  }
  else if (provider.match(/gitlab/)) {
    gitUrl = 'https://gitlab.com/' + what;
    repo = what.match(/^([^\/]+)/)[1]
  }
  else if (provider.match(/gist/)) {
    var gId = '';
    if (what.match(/^[^\/]+\/([^#]+)#.+/)) gId = what.match(/[^\/]+\/([^#]+)#.+/)[1];
    else if (what.match(/^[^\/]+\/(.+)/)) gId = what.match(/[^\/]+\/(.+)/)[1];
    else if (what.match(/^([^#]+)#.+/)) gId = what.match(/[^\/]+\/(.+)/)[1];
    else gId = what;
    repo = gId;
    gitUrl = 'https://gist.github.com/' + gId;
  }
  debug('gitUrl=%s', gitUrl)
  debug('repo=%s', repo)
  // git clone https://github.com/githubname/githubrepo#commit --recursive
  finalDir(opts, function(err, dirPath) {
    var child = spawn('git', ['clone', gitUrl, '--recursive', dirPath])
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('close', function (code) {
      if (code===0) return then(null, dirPath)
      then('error');
    })
  });
}

var gitDl = function (what, opts, then) {
  // git clone git+ssh://git@github.com:npm/npm.git#v1.0.27 --recursive
  finalDir(opts, function(err, dirPath) {
    if (err) return then(err);
    var extraEnv = {
      GIT_ASKPASS: process.env['GIT_ASKPASS'],
      GIT_PROXY_COMMAND: process.env['GIT_PROXY_COMMAND'],
      GIT_SSH: process.env['GIT_SSH'],
      GIT_SSH_COMMAND: process.env['GIT_SSH_COMMAND'],
      GIT_SSL_CAINFO: process.env['GIT_SSL_CAINFO'],
      GIT_SSL_NO_VERIFY: process.env['GIT_SSL_NO_VERIFY'],
    }
    extraEnv = JSON.parse(JSON.stringify(extraEnv))
    var repo = what.match(/\/([^\.]+)\.git/)[1]
    debug('git=%s', what)
    debug('env=%j', extraEnv)
    debug('dirPath=%s', dirPath)
    var child = spawn('git', ['clone', what, '--recursive', dirPath], {env: extraEnv})
    child.stdout.pipe(process.stdout);
    child.stderr.pipe(process.stderr);
    child.on('close', function (code) {
      if (code===0) return then(null, dirPath)
      then('error');
    })
  });
}
var tarballDl = function (what, opts, then) {
  // http://site.com/file.zip
  temp.open('s', function(err, info) {
    if (err) return then(err);
    var file = path.basename(what.replace(/^https?:\/\//, ''));
    var repo = file.replace(path.extname(file), '')
    debug('file=%s', file)
    debug('repo=%s', repo)
    debug('url=%s', what)
    debug('temp path=%s', info.path)
    hyperquest(what).pipe(fs.createWriteStream(info.path).on('close', function () {
      if (file.match(/\.zip$/)) {
        finalDir(opts, function(err, dirPath) {
          if (err) return then(err);
          debug('dirPath=%s', dirPath)
          unzipFile(info.path, dirPath, function (){
            if (err) return then(err);
            returnThisOrThatDir(dirPath, then);
          })
        });
      } else if(file.match(/\.tar$/)) {
        finalDir(opts, function(err, dirPath) {
          if (err) return then(err);
          debug('dirPath=%s', dirPath)
          untarFile(info.path, dirPath, function (){
            if (err) return then(err);
            returnThisOrThatDir(dirPath, then);
          })
        });
      } else if(file.match(/\.tgz$/) || file.match(/\.tar\.gz$/)) {
        finalDir(opts, function(err, dirPath) {
          if (err) return then(err);
          debug('dirPath=%s', dirPath)
          guntarFile(info.path, dirPath, function (){
            if (err) return then(err);
            returnThisOrThatDir(dirPath, then);
          })
        });
      } else {
        then('unhandled format')
      }
    }));

  });
}
var guntarFile = function (tarPath, targetPath, then) {
  var onError = function(err){
    then && then(err);
    then = null;
  };
  var onEnd = function(){
    then && then(null, targetPath);
  };
  var extractor = tar.Extract({path: targetPath, strip: 0})
    .on('error', onError)
    .on('end', onEnd);
  fs.createReadStream(tarPath)
    .on('error', onError)
    .pipe(zlib.createGunzip())
    .on('error', onError)
    .pipe(extractor);
    extractor
    .on('error', onError)
}
var untarFile = function (tarPath, targetPath, then) {
  var onError = function(err){
    then && then(err);
    then = null;
  };
  var onEnd = function(){
    then && then(null, targetPath);
  };
  var extractor = tar.Extract({path: targetPath})
    .on('error', onError)
    .on('end', onEnd);
  fs.createReadStream(tarPath)
    .on('error', onError)
    .pipe(extractor)
}
var unzipFile = function (zipFile, targetPath, then) {
  debug('zipFile=%s', zipFile);
  debug('targetPath=%s', targetPath);
  yauzl.open(zipFile, {lazyEntries: true}, function(err, zipfile) {
    if (err) throw err;
    zipfile.readEntry();
    zipfile.on("error", console.error.bind(console));
    zipfile.once("end", function() {
      zipfile.close();
      then();
    });
    zipfile.on("entry", function(entry) {
      if (/\/$/.test(entry.fileName)) {
        // directory file names end with '/'
        mkdirp(path.join(targetPath, entry.fileName), function(err) {
          if (err) throw err;
          zipfile.readEntry();
        });
      } else {
        // file entry
        zipfile.openReadStream(entry, function(err, readStream) {
          if (err) throw err;
          // ensure parent directory exists
          var k = path.join(targetPath, path.dirname(entry.fileName));
          mkdirp(k, function(err) {
            if (err) throw err;
            readStream.pipe(fs.createWriteStream(path.join(k, path.basename(entry.fileName))));
            readStream.on("end", function() {
              zipfile.readEntry();
            });
          });
        });
      }
    });
  });
}
var npmDl = function (what, opts, then) {
  // package
  // @scope/package
  // @scope/package@version
  // package@version
  var scope = '';
  var pkg = '';
  var version = '';
  var tag = '';
  var range = '';

  if (what.match(/^(@[^\/]+)/)) {
    scope = what.match(/^(@[^\/]+)/) && what.match(/^(@[^\/]+)/)[1]
    pkg = what.match(/^@[^\/]+\/([^@]+)/) && what.match(/^@[^\/]+\/([^@]+)/)[1]
    version = what.match(/[^@]+@([^@]+)$/) && what.match(/[^@]+@([^@]+)$/)[1]
  } else if (what.match(/^[^@]+@[^@]+$/)) {
    scope = ''
    pkg = what.match(/^([^@]+)@[^@]+$/) && what.match(/^([^@]+)@[^@]+$/)[1]
    version = what.match(/^[^@]+@([^@]+)$/) && what.match(/^[^@]+@([^@]+)$/)[1]
  } else {
    scope = ''
    pkg = what
    version = ''
  }
  if(version && semver.valid(version)!==version) {
    // it is one of tag or range
    if(semver.validRange(version)) range = version;
    else tag = version;
    version = null;
  }
  debug('scope=%s', scope)
  debug('pkg=%s', pkg)
  debug('version=%s', version)
  debug('range=%s', range)
  debug('tag=%s', tag)

  if (!pkg) return then('wrong package')

  var url = opts.registry || 'https://registry.npmjs.org/'
  if (scope) url += scope + '%2f'
  url += pkg

  debug('%s', url)

  var data = '';
  hyperquest(url)
  .on('data', function (d) {
    data += d.toString();
  })
  .on('response', function (response) {
    if (response.statusCode!==200) {
      then && then('package not found');
      then = null;
    }
  })
  .on('error', function (err) {
    then && then(err);
    then = null;
  })
  .on('end', function () {
    if (then) {
      var json;
      try{
        json = JSON.parse(data)
      }catch(ex) {
        return then(ex);
      }

      if (version) {
        if(!json.versions[version]) {
          then('version not found');
          then = null;
          return;
        }
        tarballDl(json.versions[version].dist.tarball, opts, then)
      } else if (tag) {
        if(!json['dist-tags'][tag]) {
          then('tag not found');
          then = null;
          return;
        }
        version = json['dist-tags'][tag];
        tarballDl(json.versions[version].dist.tarball, opts, then)
      } else if (range) {
        var validVersions = Object.keys(json.versions)
        .filter(function (v) {
          return semver.satisfies(v, range)
        }).sort(function (a,b) {
          if (semver.gt(a, b)) return -1
          if (semver.lt(a, b)) return 1
          return 0
        });
        debug('validVersions=%j', validVersions);
        if (!validVersions.length) return then('invalid version')
        tarballDl(json.versions[validVersions[0]].dist.tarball, opts, then)
      } else {
        var versions = Object.keys(json.versions)
        .sort(function (a,b) {
          if (semver.gt(a, b)) return -1
          if (semver.lt(a, b)) return 1
          return 0
        });
        debug('versions=%j', versions);
        if (!versions.length) return then('no version')
        tarballDl(json.versions[versions[0]].dist.tarball, opts, then)
      }
    }
  })
}
var returnThisOrThatDir = function (p, then) {
  fs.readdir(p, function (err, files) {
    if(err) return then(err);
    if(files.length>1) return then(null, p);
    fs.stat(path.join(p, files[0]), function (err, stats) {
      if(stats.isDirectory()) return then(null, path.join(p, files[0]))
      then(null, path);
    })
  })
}
