import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  historyPath
} from "./chunk-EMN4BFNA.mjs";
import {
  readJson,
  writeJsonAtomic
} from "./chunk-VLCMFCCN.mjs";
import {
  compileBrandAliases,
  normalizeBrand,
  normalizeComparableBrand
} from "./chunk-IVODUSOD.mjs";
import {
  __commonJS,
  __require,
  __toESM,
  normalizeFuelLabel,
  petrolOctaneKey
} from "./chunk-XKTP5TT3.mjs";

// node_modules/graceful-fs/polyfills.js
var require_polyfills = __commonJS({
  "node_modules/graceful-fs/polyfills.js"(exports, module) {
    var constants2 = __require("constants");
    var origCwd = process.cwd;
    var cwd = null;
    var platform = process.env.GRACEFUL_FS_PLATFORM || process.platform;
    process.cwd = function() {
      if (!cwd)
        cwd = origCwd.call(process);
      return cwd;
    };
    try {
      process.cwd();
    } catch (er) {
    }
    if (typeof process.chdir === "function") {
      chdir = process.chdir;
      process.chdir = function(d) {
        cwd = null;
        chdir.call(process, d);
      };
      if (Object.setPrototypeOf) Object.setPrototypeOf(process.chdir, chdir);
    }
    var chdir;
    module.exports = patch;
    function patch(fs) {
      if (constants2.hasOwnProperty("O_SYMLINK") && process.version.match(/^v0\.6\.[0-2]|^v0\.5\./)) {
        patchLchmod(fs);
      }
      if (!fs.lutimes) {
        patchLutimes(fs);
      }
      fs.chown = chownFix(fs.chown);
      fs.fchown = chownFix(fs.fchown);
      fs.lchown = chownFix(fs.lchown);
      fs.chmod = chmodFix(fs.chmod);
      fs.fchmod = chmodFix(fs.fchmod);
      fs.lchmod = chmodFix(fs.lchmod);
      fs.chownSync = chownFixSync(fs.chownSync);
      fs.fchownSync = chownFixSync(fs.fchownSync);
      fs.lchownSync = chownFixSync(fs.lchownSync);
      fs.chmodSync = chmodFixSync(fs.chmodSync);
      fs.fchmodSync = chmodFixSync(fs.fchmodSync);
      fs.lchmodSync = chmodFixSync(fs.lchmodSync);
      fs.stat = statFix(fs.stat);
      fs.fstat = statFix(fs.fstat);
      fs.lstat = statFix(fs.lstat);
      fs.statSync = statFixSync(fs.statSync);
      fs.fstatSync = statFixSync(fs.fstatSync);
      fs.lstatSync = statFixSync(fs.lstatSync);
      if (fs.chmod && !fs.lchmod) {
        fs.lchmod = function(path, mode, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchmodSync = function() {
        };
      }
      if (fs.chown && !fs.lchown) {
        fs.lchown = function(path, uid, gid, cb) {
          if (cb) process.nextTick(cb);
        };
        fs.lchownSync = function() {
        };
      }
      if (platform === "win32") {
        fs.rename = typeof fs.rename !== "function" ? fs.rename : (function(fs$rename) {
          function rename2(from, to, cb) {
            var start = Date.now();
            var backoff = 0;
            fs$rename(from, to, function CB(er) {
              if (er && (er.code === "EACCES" || er.code === "EPERM" || er.code === "EBUSY") && Date.now() - start < 6e4) {
                setTimeout(function() {
                  fs.stat(to, function(stater, st) {
                    if (stater && stater.code === "ENOENT")
                      fs$rename(from, to, CB);
                    else
                      cb(er);
                  });
                }, backoff);
                if (backoff < 100)
                  backoff += 10;
                return;
              }
              if (cb) cb(er);
            });
          }
          if (Object.setPrototypeOf) Object.setPrototypeOf(rename2, fs$rename);
          return rename2;
        })(fs.rename);
      }
      fs.read = typeof fs.read !== "function" ? fs.read : (function(fs$read) {
        function read(fd, buffer, offset, length, position, callback_) {
          var callback;
          if (callback_ && typeof callback_ === "function") {
            var eagCounter = 0;
            callback = function(er, _, __) {
              if (er && er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                return fs$read.call(fs, fd, buffer, offset, length, position, callback);
              }
              callback_.apply(this, arguments);
            };
          }
          return fs$read.call(fs, fd, buffer, offset, length, position, callback);
        }
        if (Object.setPrototypeOf) Object.setPrototypeOf(read, fs$read);
        return read;
      })(fs.read);
      fs.readSync = typeof fs.readSync !== "function" ? fs.readSync : /* @__PURE__ */ (function(fs$readSync) {
        return function(fd, buffer, offset, length, position) {
          var eagCounter = 0;
          while (true) {
            try {
              return fs$readSync.call(fs, fd, buffer, offset, length, position);
            } catch (er) {
              if (er.code === "EAGAIN" && eagCounter < 10) {
                eagCounter++;
                continue;
              }
              throw er;
            }
          }
        };
      })(fs.readSync);
      function patchLchmod(fs2) {
        fs2.lchmod = function(path, mode, callback) {
          fs2.open(
            path,
            constants2.O_WRONLY | constants2.O_SYMLINK,
            mode,
            function(err, fd) {
              if (err) {
                if (callback) callback(err);
                return;
              }
              fs2.fchmod(fd, mode, function(err2) {
                fs2.close(fd, function(err22) {
                  if (callback) callback(err2 || err22);
                });
              });
            }
          );
        };
        fs2.lchmodSync = function(path, mode) {
          var fd = fs2.openSync(path, constants2.O_WRONLY | constants2.O_SYMLINK, mode);
          var threw = true;
          var ret;
          try {
            ret = fs2.fchmodSync(fd, mode);
            threw = false;
          } finally {
            if (threw) {
              try {
                fs2.closeSync(fd);
              } catch (er) {
              }
            } else {
              fs2.closeSync(fd);
            }
          }
          return ret;
        };
      }
      function patchLutimes(fs2) {
        if (constants2.hasOwnProperty("O_SYMLINK") && fs2.futimes) {
          fs2.lutimes = function(path, at, mt, cb) {
            fs2.open(path, constants2.O_SYMLINK, function(er, fd) {
              if (er) {
                if (cb) cb(er);
                return;
              }
              fs2.futimes(fd, at, mt, function(er2) {
                fs2.close(fd, function(er22) {
                  if (cb) cb(er2 || er22);
                });
              });
            });
          };
          fs2.lutimesSync = function(path, at, mt) {
            var fd = fs2.openSync(path, constants2.O_SYMLINK);
            var ret;
            var threw = true;
            try {
              ret = fs2.futimesSync(fd, at, mt);
              threw = false;
            } finally {
              if (threw) {
                try {
                  fs2.closeSync(fd);
                } catch (er) {
                }
              } else {
                fs2.closeSync(fd);
              }
            }
            return ret;
          };
        } else if (fs2.futimes) {
          fs2.lutimes = function(_a, _b, _c, cb) {
            if (cb) process.nextTick(cb);
          };
          fs2.lutimesSync = function() {
          };
        }
      }
      function chmodFix(orig) {
        if (!orig) return orig;
        return function(target, mode, cb) {
          return orig.call(fs, target, mode, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chmodFixSync(orig) {
        if (!orig) return orig;
        return function(target, mode) {
          try {
            return orig.call(fs, target, mode);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function chownFix(orig) {
        if (!orig) return orig;
        return function(target, uid, gid, cb) {
          return orig.call(fs, target, uid, gid, function(er) {
            if (chownErOk(er)) er = null;
            if (cb) cb.apply(this, arguments);
          });
        };
      }
      function chownFixSync(orig) {
        if (!orig) return orig;
        return function(target, uid, gid) {
          try {
            return orig.call(fs, target, uid, gid);
          } catch (er) {
            if (!chownErOk(er)) throw er;
          }
        };
      }
      function statFix(orig) {
        if (!orig) return orig;
        return function(target, options, cb) {
          if (typeof options === "function") {
            cb = options;
            options = null;
          }
          function callback(er, stats) {
            if (stats) {
              if (stats.uid < 0) stats.uid += 4294967296;
              if (stats.gid < 0) stats.gid += 4294967296;
            }
            if (cb) cb.apply(this, arguments);
          }
          return options ? orig.call(fs, target, options, callback) : orig.call(fs, target, callback);
        };
      }
      function statFixSync(orig) {
        if (!orig) return orig;
        return function(target, options) {
          var stats = options ? orig.call(fs, target, options) : orig.call(fs, target);
          if (stats) {
            if (stats.uid < 0) stats.uid += 4294967296;
            if (stats.gid < 0) stats.gid += 4294967296;
          }
          return stats;
        };
      }
      function chownErOk(er) {
        if (!er)
          return true;
        if (er.code === "ENOSYS")
          return true;
        var nonroot = !process.getuid || process.getuid() !== 0;
        if (nonroot) {
          if (er.code === "EINVAL" || er.code === "EPERM")
            return true;
        }
        return false;
      }
    }
  }
});

// node_modules/graceful-fs/legacy-streams.js
var require_legacy_streams = __commonJS({
  "node_modules/graceful-fs/legacy-streams.js"(exports, module) {
    var Stream = __require("stream").Stream;
    module.exports = legacy;
    function legacy(fs) {
      return {
        ReadStream,
        WriteStream
      };
      function ReadStream(path, options) {
        if (!(this instanceof ReadStream)) return new ReadStream(path, options);
        Stream.call(this);
        var self = this;
        this.path = path;
        this.fd = null;
        this.readable = true;
        this.paused = false;
        this.flags = "r";
        this.mode = 438;
        this.bufferSize = 64 * 1024;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.encoding) this.setEncoding(this.encoding);
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.end === void 0) {
            this.end = Infinity;
          } else if ("number" !== typeof this.end) {
            throw TypeError("end must be a Number");
          }
          if (this.start > this.end) {
            throw new Error("start must be <= end");
          }
          this.pos = this.start;
        }
        if (this.fd !== null) {
          process.nextTick(function() {
            self._read();
          });
          return;
        }
        fs.open(this.path, this.flags, this.mode, function(err, fd) {
          if (err) {
            self.emit("error", err);
            self.readable = false;
            return;
          }
          self.fd = fd;
          self.emit("open", fd);
          self._read();
        });
      }
      function WriteStream(path, options) {
        if (!(this instanceof WriteStream)) return new WriteStream(path, options);
        Stream.call(this);
        this.path = path;
        this.fd = null;
        this.writable = true;
        this.flags = "w";
        this.encoding = "binary";
        this.mode = 438;
        this.bytesWritten = 0;
        options = options || {};
        var keys = Object.keys(options);
        for (var index = 0, length = keys.length; index < length; index++) {
          var key = keys[index];
          this[key] = options[key];
        }
        if (this.start !== void 0) {
          if ("number" !== typeof this.start) {
            throw TypeError("start must be a Number");
          }
          if (this.start < 0) {
            throw new Error("start must be >= zero");
          }
          this.pos = this.start;
        }
        this.busy = false;
        this._queue = [];
        if (this.fd === null) {
          this._open = fs.open;
          this._queue.push([this._open, this.path, this.flags, this.mode, void 0]);
          this.flush();
        }
      }
    }
  }
});

// node_modules/graceful-fs/clone.js
var require_clone = __commonJS({
  "node_modules/graceful-fs/clone.js"(exports, module) {
    "use strict";
    module.exports = clone;
    var getPrototypeOf = Object.getPrototypeOf || function(obj) {
      return obj.__proto__;
    };
    function clone(obj) {
      if (obj === null || typeof obj !== "object")
        return obj;
      if (obj instanceof Object)
        var copy = { __proto__: getPrototypeOf(obj) };
      else
        var copy = /* @__PURE__ */ Object.create(null);
      Object.getOwnPropertyNames(obj).forEach(function(key) {
        Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
      });
      return copy;
    }
  }
});

// node_modules/graceful-fs/graceful-fs.js
var require_graceful_fs = __commonJS({
  "node_modules/graceful-fs/graceful-fs.js"(exports, module) {
    var fs = __require("fs");
    var polyfills = require_polyfills();
    var legacy = require_legacy_streams();
    var clone = require_clone();
    var util = __require("util");
    var gracefulQueue;
    var previousSymbol;
    if (typeof Symbol === "function" && typeof Symbol.for === "function") {
      gracefulQueue = Symbol.for("graceful-fs.queue");
      previousSymbol = Symbol.for("graceful-fs.previous");
    } else {
      gracefulQueue = "___graceful-fs.queue";
      previousSymbol = "___graceful-fs.previous";
    }
    function noop() {
    }
    function publishQueue(context, queue2) {
      Object.defineProperty(context, gracefulQueue, {
        get: function() {
          return queue2;
        }
      });
    }
    var debug = noop;
    if (util.debuglog)
      debug = util.debuglog("gfs4");
    else if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || ""))
      debug = function() {
        var m = util.format.apply(util, arguments);
        m = "GFS4: " + m.split(/\n/).join("\nGFS4: ");
        console.error(m);
      };
    if (!fs[gracefulQueue]) {
      queue = global[gracefulQueue] || [];
      publishQueue(fs, queue);
      fs.close = (function(fs$close) {
        function close(fd, cb) {
          return fs$close.call(fs, fd, function(err) {
            if (!err) {
              resetQueue();
            }
            if (typeof cb === "function")
              cb.apply(this, arguments);
          });
        }
        Object.defineProperty(close, previousSymbol, {
          value: fs$close
        });
        return close;
      })(fs.close);
      fs.closeSync = (function(fs$closeSync) {
        function closeSync(fd) {
          fs$closeSync.apply(fs, arguments);
          resetQueue();
        }
        Object.defineProperty(closeSync, previousSymbol, {
          value: fs$closeSync
        });
        return closeSync;
      })(fs.closeSync);
      if (/\bgfs4\b/i.test(process.env.NODE_DEBUG || "")) {
        process.on("exit", function() {
          debug(fs[gracefulQueue]);
          __require("assert").equal(fs[gracefulQueue].length, 0);
        });
      }
    }
    var queue;
    if (!global[gracefulQueue]) {
      publishQueue(global, fs[gracefulQueue]);
    }
    module.exports = patch(clone(fs));
    if (process.env.TEST_GRACEFUL_FS_GLOBAL_PATCH && !fs.__patched) {
      module.exports = patch(fs);
      fs.__patched = true;
    }
    function patch(fs2) {
      polyfills(fs2);
      fs2.gracefulify = patch;
      fs2.createReadStream = createReadStream;
      fs2.createWriteStream = createWriteStream;
      var fs$readFile = fs2.readFile;
      fs2.readFile = readFile2;
      function readFile2(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$readFile(path, options, cb);
        function go$readFile(path2, options2, cb2, startTime) {
          return fs$readFile(path2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$readFile, [path2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$writeFile = fs2.writeFile;
      fs2.writeFile = writeFile2;
      function writeFile2(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$writeFile(path, data, options, cb);
        function go$writeFile(path2, data2, options2, cb2, startTime) {
          return fs$writeFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$writeFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$appendFile = fs2.appendFile;
      if (fs$appendFile)
        fs2.appendFile = appendFile2;
      function appendFile2(path, data, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        return go$appendFile(path, data, options, cb);
        function go$appendFile(path2, data2, options2, cb2, startTime) {
          return fs$appendFile(path2, data2, options2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$appendFile, [path2, data2, options2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$copyFile = fs2.copyFile;
      if (fs$copyFile)
        fs2.copyFile = copyFile2;
      function copyFile2(src, dest, flags, cb) {
        if (typeof flags === "function") {
          cb = flags;
          flags = 0;
        }
        return go$copyFile(src, dest, flags, cb);
        function go$copyFile(src2, dest2, flags2, cb2, startTime) {
          return fs$copyFile(src2, dest2, flags2, function(err) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$copyFile, [src2, dest2, flags2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      var fs$readdir = fs2.readdir;
      fs2.readdir = readdir2;
      var noReaddirOptionVersions = /^v[0-5]\./;
      function readdir2(path, options, cb) {
        if (typeof options === "function")
          cb = options, options = null;
        var go$readdir = noReaddirOptionVersions.test(process.version) ? function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        } : function go$readdir2(path2, options2, cb2, startTime) {
          return fs$readdir(path2, options2, fs$readdirCallback(
            path2,
            options2,
            cb2,
            startTime
          ));
        };
        return go$readdir(path, options, cb);
        function fs$readdirCallback(path2, options2, cb2, startTime) {
          return function(err, files) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([
                go$readdir,
                [path2, options2, cb2],
                err,
                startTime || Date.now(),
                Date.now()
              ]);
            else {
              if (files && files.sort)
                files.sort();
              if (typeof cb2 === "function")
                cb2.call(this, err, files);
            }
          };
        }
      }
      if (process.version.substr(0, 4) === "v0.8") {
        var legStreams = legacy(fs2);
        ReadStream = legStreams.ReadStream;
        WriteStream = legStreams.WriteStream;
      }
      var fs$ReadStream = fs2.ReadStream;
      if (fs$ReadStream) {
        ReadStream.prototype = Object.create(fs$ReadStream.prototype);
        ReadStream.prototype.open = ReadStream$open;
      }
      var fs$WriteStream = fs2.WriteStream;
      if (fs$WriteStream) {
        WriteStream.prototype = Object.create(fs$WriteStream.prototype);
        WriteStream.prototype.open = WriteStream$open;
      }
      Object.defineProperty(fs2, "ReadStream", {
        get: function() {
          return ReadStream;
        },
        set: function(val) {
          ReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(fs2, "WriteStream", {
        get: function() {
          return WriteStream;
        },
        set: function(val) {
          WriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileReadStream = ReadStream;
      Object.defineProperty(fs2, "FileReadStream", {
        get: function() {
          return FileReadStream;
        },
        set: function(val) {
          FileReadStream = val;
        },
        enumerable: true,
        configurable: true
      });
      var FileWriteStream = WriteStream;
      Object.defineProperty(fs2, "FileWriteStream", {
        get: function() {
          return FileWriteStream;
        },
        set: function(val) {
          FileWriteStream = val;
        },
        enumerable: true,
        configurable: true
      });
      function ReadStream(path, options) {
        if (this instanceof ReadStream)
          return fs$ReadStream.apply(this, arguments), this;
        else
          return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
      }
      function ReadStream$open() {
        var that = this;
        open2(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            if (that.autoClose)
              that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
            that.read();
          }
        });
      }
      function WriteStream(path, options) {
        if (this instanceof WriteStream)
          return fs$WriteStream.apply(this, arguments), this;
        else
          return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
      }
      function WriteStream$open() {
        var that = this;
        open2(that.path, that.flags, that.mode, function(err, fd) {
          if (err) {
            that.destroy();
            that.emit("error", err);
          } else {
            that.fd = fd;
            that.emit("open", fd);
          }
        });
      }
      function createReadStream(path, options) {
        return new fs2.ReadStream(path, options);
      }
      function createWriteStream(path, options) {
        return new fs2.WriteStream(path, options);
      }
      var fs$open = fs2.open;
      fs2.open = open2;
      function open2(path, flags, mode, cb) {
        if (typeof mode === "function")
          cb = mode, mode = null;
        return go$open(path, flags, mode, cb);
        function go$open(path2, flags2, mode2, cb2, startTime) {
          return fs$open(path2, flags2, mode2, function(err, fd) {
            if (err && (err.code === "EMFILE" || err.code === "ENFILE"))
              enqueue([go$open, [path2, flags2, mode2, cb2], err, startTime || Date.now(), Date.now()]);
            else {
              if (typeof cb2 === "function")
                cb2.apply(this, arguments);
            }
          });
        }
      }
      return fs2;
    }
    function enqueue(elem) {
      debug("ENQUEUE", elem[0].name, elem[1]);
      fs[gracefulQueue].push(elem);
      retry();
    }
    var retryTimer;
    function resetQueue() {
      var now = Date.now();
      for (var i = 0; i < fs[gracefulQueue].length; ++i) {
        if (fs[gracefulQueue][i].length > 2) {
          fs[gracefulQueue][i][3] = now;
          fs[gracefulQueue][i][4] = now;
        }
      }
      retry();
    }
    function retry() {
      clearTimeout(retryTimer);
      retryTimer = void 0;
      if (fs[gracefulQueue].length === 0)
        return;
      var elem = fs[gracefulQueue].shift();
      var fn = elem[0];
      var args = elem[1];
      var err = elem[2];
      var startTime = elem[3];
      var lastTime = elem[4];
      if (startTime === void 0) {
        debug("RETRY", fn.name, args);
        fn.apply(null, args);
      } else if (Date.now() - startTime >= 6e4) {
        debug("TIMEOUT", fn.name, args);
        var cb = args.pop();
        if (typeof cb === "function")
          cb.call(null, err);
      } else {
        var sinceAttempt = Date.now() - lastTime;
        var sinceStart = Math.max(lastTime - startTime, 1);
        var desiredDelay = Math.min(sinceStart * 1.2, 100);
        if (sinceAttempt >= desiredDelay) {
          debug("RETRY", fn.name, args);
          fn.apply(null, args.concat([startTime]));
        } else {
          fs[gracefulQueue].push(elem);
        }
      }
      if (retryTimer === void 0) {
        retryTimer = setTimeout(retry, 0);
      }
    }
  }
});

// node_modules/retry/lib/retry_operation.js
var require_retry_operation = __commonJS({
  "node_modules/retry/lib/retry_operation.js"(exports, module) {
    function RetryOperation(timeouts, options) {
      if (typeof options === "boolean") {
        options = { forever: options };
      }
      this._originalTimeouts = JSON.parse(JSON.stringify(timeouts));
      this._timeouts = timeouts;
      this._options = options || {};
      this._maxRetryTime = options && options.maxRetryTime || Infinity;
      this._fn = null;
      this._errors = [];
      this._attempts = 1;
      this._operationTimeout = null;
      this._operationTimeoutCb = null;
      this._timeout = null;
      this._operationStart = null;
      if (this._options.forever) {
        this._cachedTimeouts = this._timeouts.slice(0);
      }
    }
    module.exports = RetryOperation;
    RetryOperation.prototype.reset = function() {
      this._attempts = 1;
      this._timeouts = this._originalTimeouts;
    };
    RetryOperation.prototype.stop = function() {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      this._timeouts = [];
      this._cachedTimeouts = null;
    };
    RetryOperation.prototype.retry = function(err) {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      if (!err) {
        return false;
      }
      var currentTime = (/* @__PURE__ */ new Date()).getTime();
      if (err && currentTime - this._operationStart >= this._maxRetryTime) {
        this._errors.unshift(new Error("RetryOperation timeout occurred"));
        return false;
      }
      this._errors.push(err);
      var timeout = this._timeouts.shift();
      if (timeout === void 0) {
        if (this._cachedTimeouts) {
          this._errors.splice(this._errors.length - 1, this._errors.length);
          this._timeouts = this._cachedTimeouts.slice(0);
          timeout = this._timeouts.shift();
        } else {
          return false;
        }
      }
      var self = this;
      var timer = setTimeout(function() {
        self._attempts++;
        if (self._operationTimeoutCb) {
          self._timeout = setTimeout(function() {
            self._operationTimeoutCb(self._attempts);
          }, self._operationTimeout);
          if (self._options.unref) {
            self._timeout.unref();
          }
        }
        self._fn(self._attempts);
      }, timeout);
      if (this._options.unref) {
        timer.unref();
      }
      return true;
    };
    RetryOperation.prototype.attempt = function(fn, timeoutOps) {
      this._fn = fn;
      if (timeoutOps) {
        if (timeoutOps.timeout) {
          this._operationTimeout = timeoutOps.timeout;
        }
        if (timeoutOps.cb) {
          this._operationTimeoutCb = timeoutOps.cb;
        }
      }
      var self = this;
      if (this._operationTimeoutCb) {
        this._timeout = setTimeout(function() {
          self._operationTimeoutCb();
        }, self._operationTimeout);
      }
      this._operationStart = (/* @__PURE__ */ new Date()).getTime();
      this._fn(this._attempts);
    };
    RetryOperation.prototype.try = function(fn) {
      console.log("Using RetryOperation.try() is deprecated");
      this.attempt(fn);
    };
    RetryOperation.prototype.start = function(fn) {
      console.log("Using RetryOperation.start() is deprecated");
      this.attempt(fn);
    };
    RetryOperation.prototype.start = RetryOperation.prototype.try;
    RetryOperation.prototype.errors = function() {
      return this._errors;
    };
    RetryOperation.prototype.attempts = function() {
      return this._attempts;
    };
    RetryOperation.prototype.mainError = function() {
      if (this._errors.length === 0) {
        return null;
      }
      var counts = {};
      var mainError = null;
      var mainErrorCount = 0;
      for (var i = 0; i < this._errors.length; i++) {
        var error = this._errors[i];
        var message = error.message;
        var count = (counts[message] || 0) + 1;
        counts[message] = count;
        if (count >= mainErrorCount) {
          mainError = error;
          mainErrorCount = count;
        }
      }
      return mainError;
    };
  }
});

// node_modules/retry/lib/retry.js
var require_retry = __commonJS({
  "node_modules/retry/lib/retry.js"(exports) {
    var RetryOperation = require_retry_operation();
    exports.operation = function(options) {
      var timeouts = exports.timeouts(options);
      return new RetryOperation(timeouts, {
        forever: options && options.forever,
        unref: options && options.unref,
        maxRetryTime: options && options.maxRetryTime
      });
    };
    exports.timeouts = function(options) {
      if (options instanceof Array) {
        return [].concat(options);
      }
      var opts = {
        retries: 10,
        factor: 2,
        minTimeout: 1 * 1e3,
        maxTimeout: Infinity,
        randomize: false
      };
      for (var key in options) {
        opts[key] = options[key];
      }
      if (opts.minTimeout > opts.maxTimeout) {
        throw new Error("minTimeout is greater than maxTimeout");
      }
      var timeouts = [];
      for (var i = 0; i < opts.retries; i++) {
        timeouts.push(this.createTimeout(i, opts));
      }
      if (options && options.forever && !timeouts.length) {
        timeouts.push(this.createTimeout(i, opts));
      }
      timeouts.sort(function(a, b) {
        return a - b;
      });
      return timeouts;
    };
    exports.createTimeout = function(attempt, opts) {
      var random = opts.randomize ? Math.random() + 1 : 1;
      var timeout = Math.round(random * opts.minTimeout * Math.pow(opts.factor, attempt));
      timeout = Math.min(timeout, opts.maxTimeout);
      return timeout;
    };
    exports.wrap = function(obj, options, methods) {
      if (options instanceof Array) {
        methods = options;
        options = null;
      }
      if (!methods) {
        methods = [];
        for (var key in obj) {
          if (typeof obj[key] === "function") {
            methods.push(key);
          }
        }
      }
      for (var i = 0; i < methods.length; i++) {
        var method = methods[i];
        var original = obj[method];
        obj[method] = function retryWrapper(original2) {
          var op = exports.operation(options);
          var args = Array.prototype.slice.call(arguments, 1);
          var callback = args.pop();
          args.push(function(err) {
            if (op.retry(err)) {
              return;
            }
            if (err) {
              arguments[0] = op.mainError();
            }
            callback.apply(this, arguments);
          });
          op.attempt(function() {
            original2.apply(obj, args);
          });
        }.bind(obj, original);
        obj[method].options = options;
      }
    };
  }
});

// node_modules/retry/index.js
var require_retry2 = __commonJS({
  "node_modules/retry/index.js"(exports, module) {
    module.exports = require_retry();
  }
});

// node_modules/signal-exit/signals.js
var require_signals = __commonJS({
  "node_modules/signal-exit/signals.js"(exports, module) {
    module.exports = [
      "SIGABRT",
      "SIGALRM",
      "SIGHUP",
      "SIGINT",
      "SIGTERM"
    ];
    if (process.platform !== "win32") {
      module.exports.push(
        "SIGVTALRM",
        "SIGXCPU",
        "SIGXFSZ",
        "SIGUSR2",
        "SIGTRAP",
        "SIGSYS",
        "SIGQUIT",
        "SIGIOT"
        // should detect profiler and enable/disable accordingly.
        // see #21
        // 'SIGPROF'
      );
    }
    if (process.platform === "linux") {
      module.exports.push(
        "SIGIO",
        "SIGPOLL",
        "SIGPWR",
        "SIGSTKFLT",
        "SIGUNUSED"
      );
    }
  }
});

// node_modules/signal-exit/index.js
var require_signal_exit = __commonJS({
  "node_modules/signal-exit/index.js"(exports, module) {
    var process2 = global.process;
    var processOk = function(process3) {
      return process3 && typeof process3 === "object" && typeof process3.removeListener === "function" && typeof process3.emit === "function" && typeof process3.reallyExit === "function" && typeof process3.listeners === "function" && typeof process3.kill === "function" && typeof process3.pid === "number" && typeof process3.on === "function";
    };
    if (!processOk(process2)) {
      module.exports = function() {
        return function() {
        };
      };
    } else {
      assert = __require("assert");
      signals = require_signals();
      isWin = /^win/i.test(process2.platform);
      EE = __require("events");
      if (typeof EE !== "function") {
        EE = EE.EventEmitter;
      }
      if (process2.__signal_exit_emitter__) {
        emitter = process2.__signal_exit_emitter__;
      } else {
        emitter = process2.__signal_exit_emitter__ = new EE();
        emitter.count = 0;
        emitter.emitted = {};
      }
      if (!emitter.infinite) {
        emitter.setMaxListeners(Infinity);
        emitter.infinite = true;
      }
      module.exports = function(cb, opts) {
        if (!processOk(global.process)) {
          return function() {
          };
        }
        assert.equal(typeof cb, "function", "a callback must be provided for exit handler");
        if (loaded === false) {
          load();
        }
        var ev = "exit";
        if (opts && opts.alwaysLast) {
          ev = "afterexit";
        }
        var remove = function() {
          emitter.removeListener(ev, cb);
          if (emitter.listeners("exit").length === 0 && emitter.listeners("afterexit").length === 0) {
            unload();
          }
        };
        emitter.on(ev, cb);
        return remove;
      };
      unload = function unload2() {
        if (!loaded || !processOk(global.process)) {
          return;
        }
        loaded = false;
        signals.forEach(function(sig) {
          try {
            process2.removeListener(sig, sigListeners[sig]);
          } catch (er) {
          }
        });
        process2.emit = originalProcessEmit;
        process2.reallyExit = originalProcessReallyExit;
        emitter.count -= 1;
      };
      module.exports.unload = unload;
      emit = function emit2(event, code, signal) {
        if (emitter.emitted[event]) {
          return;
        }
        emitter.emitted[event] = true;
        emitter.emit(event, code, signal);
      };
      sigListeners = {};
      signals.forEach(function(sig) {
        sigListeners[sig] = function listener() {
          if (!processOk(global.process)) {
            return;
          }
          var listeners = process2.listeners(sig);
          if (listeners.length === emitter.count) {
            unload();
            emit("exit", null, sig);
            emit("afterexit", null, sig);
            if (isWin && sig === "SIGHUP") {
              sig = "SIGINT";
            }
            process2.kill(process2.pid, sig);
          }
        };
      });
      module.exports.signals = function() {
        return signals;
      };
      loaded = false;
      load = function load2() {
        if (loaded || !processOk(global.process)) {
          return;
        }
        loaded = true;
        emitter.count += 1;
        signals = signals.filter(function(sig) {
          try {
            process2.on(sig, sigListeners[sig]);
            return true;
          } catch (er) {
            return false;
          }
        });
        process2.emit = processEmit;
        process2.reallyExit = processReallyExit;
      };
      module.exports.load = load;
      originalProcessReallyExit = process2.reallyExit;
      processReallyExit = function processReallyExit2(code) {
        if (!processOk(global.process)) {
          return;
        }
        process2.exitCode = code || /* istanbul ignore next */
        0;
        emit("exit", process2.exitCode, null);
        emit("afterexit", process2.exitCode, null);
        originalProcessReallyExit.call(process2, process2.exitCode);
      };
      originalProcessEmit = process2.emit;
      processEmit = function processEmit2(ev, arg) {
        if (ev === "exit" && processOk(global.process)) {
          if (arg !== void 0) {
            process2.exitCode = arg;
          }
          var ret = originalProcessEmit.apply(this, arguments);
          emit("exit", process2.exitCode, null);
          emit("afterexit", process2.exitCode, null);
          return ret;
        } else {
          return originalProcessEmit.apply(this, arguments);
        }
      };
    }
    var assert;
    var signals;
    var isWin;
    var EE;
    var emitter;
    var unload;
    var emit;
    var sigListeners;
    var loaded;
    var load;
    var originalProcessReallyExit;
    var processReallyExit;
    var originalProcessEmit;
    var processEmit;
  }
});

// node_modules/proper-lockfile/lib/mtime-precision.js
var require_mtime_precision = __commonJS({
  "node_modules/proper-lockfile/lib/mtime-precision.js"(exports, module) {
    "use strict";
    var cacheSymbol = Symbol();
    function probe(file, fs, callback) {
      const cachedPrecision = fs[cacheSymbol];
      if (cachedPrecision) {
        return fs.stat(file, (err, stat2) => {
          if (err) {
            return callback(err);
          }
          callback(null, stat2.mtime, cachedPrecision);
        });
      }
      const mtime = new Date(Math.ceil(Date.now() / 1e3) * 1e3 + 5);
      fs.utimes(file, mtime, mtime, (err) => {
        if (err) {
          return callback(err);
        }
        fs.stat(file, (err2, stat2) => {
          if (err2) {
            return callback(err2);
          }
          const precision = stat2.mtime.getTime() % 1e3 === 0 ? "s" : "ms";
          Object.defineProperty(fs, cacheSymbol, { value: precision });
          callback(null, stat2.mtime, precision);
        });
      });
    }
    function getMtime(precision) {
      let now = Date.now();
      if (precision === "s") {
        now = Math.ceil(now / 1e3) * 1e3;
      }
      return new Date(now);
    }
    module.exports.probe = probe;
    module.exports.getMtime = getMtime;
  }
});

// node_modules/proper-lockfile/lib/lockfile.js
var require_lockfile = __commonJS({
  "node_modules/proper-lockfile/lib/lockfile.js"(exports, module) {
    "use strict";
    var path = __require("path");
    var fs = require_graceful_fs();
    var retry = require_retry2();
    var onExit = require_signal_exit();
    var mtimePrecision = require_mtime_precision();
    var locks = {};
    function getLockFile(file, options) {
      return options.lockfilePath || `${file}.lock`;
    }
    function resolveCanonicalPath(file, options, callback) {
      if (!options.realpath) {
        return callback(null, path.resolve(file));
      }
      options.fs.realpath(file, callback);
    }
    function acquireLock(file, options, callback) {
      const lockfilePath = getLockFile(file, options);
      options.fs.mkdir(lockfilePath, (err) => {
        if (!err) {
          return mtimePrecision.probe(lockfilePath, options.fs, (err2, mtime, mtimePrecision2) => {
            if (err2) {
              options.fs.rmdir(lockfilePath, () => {
              });
              return callback(err2);
            }
            callback(null, mtime, mtimePrecision2);
          });
        }
        if (err.code !== "EEXIST") {
          return callback(err);
        }
        if (options.stale <= 0) {
          return callback(Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED", file }));
        }
        options.fs.stat(lockfilePath, (err2, stat2) => {
          if (err2) {
            if (err2.code === "ENOENT") {
              return acquireLock(file, { ...options, stale: 0 }, callback);
            }
            return callback(err2);
          }
          if (!isLockStale(stat2, options)) {
            return callback(Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED", file }));
          }
          removeLock(file, options, (err3) => {
            if (err3) {
              return callback(err3);
            }
            acquireLock(file, { ...options, stale: 0 }, callback);
          });
        });
      });
    }
    function isLockStale(stat2, options) {
      return stat2.mtime.getTime() < Date.now() - options.stale;
    }
    function removeLock(file, options, callback) {
      options.fs.rmdir(getLockFile(file, options), (err) => {
        if (err && err.code !== "ENOENT") {
          return callback(err);
        }
        callback();
      });
    }
    function updateLock(file, options) {
      const lock2 = locks[file];
      if (lock2.updateTimeout) {
        return;
      }
      lock2.updateDelay = lock2.updateDelay || options.update;
      lock2.updateTimeout = setTimeout(() => {
        lock2.updateTimeout = null;
        options.fs.stat(lock2.lockfilePath, (err, stat2) => {
          const isOverThreshold = lock2.lastUpdate + options.stale < Date.now();
          if (err) {
            if (err.code === "ENOENT" || isOverThreshold) {
              return setLockAsCompromised(file, lock2, Object.assign(err, { code: "ECOMPROMISED" }));
            }
            lock2.updateDelay = 1e3;
            return updateLock(file, options);
          }
          const isMtimeOurs = lock2.mtime.getTime() === stat2.mtime.getTime();
          if (!isMtimeOurs) {
            return setLockAsCompromised(
              file,
              lock2,
              Object.assign(
                new Error("Unable to update lock within the stale threshold"),
                { code: "ECOMPROMISED" }
              )
            );
          }
          const mtime = mtimePrecision.getMtime(lock2.mtimePrecision);
          options.fs.utimes(lock2.lockfilePath, mtime, mtime, (err2) => {
            const isOverThreshold2 = lock2.lastUpdate + options.stale < Date.now();
            if (lock2.released) {
              return;
            }
            if (err2) {
              if (err2.code === "ENOENT" || isOverThreshold2) {
                return setLockAsCompromised(file, lock2, Object.assign(err2, { code: "ECOMPROMISED" }));
              }
              lock2.updateDelay = 1e3;
              return updateLock(file, options);
            }
            lock2.mtime = mtime;
            lock2.lastUpdate = Date.now();
            lock2.updateDelay = null;
            updateLock(file, options);
          });
        });
      }, lock2.updateDelay);
      if (lock2.updateTimeout.unref) {
        lock2.updateTimeout.unref();
      }
    }
    function setLockAsCompromised(file, lock2, err) {
      lock2.released = true;
      if (lock2.updateTimeout) {
        clearTimeout(lock2.updateTimeout);
      }
      if (locks[file] === lock2) {
        delete locks[file];
      }
      lock2.options.onCompromised(err);
    }
    function lock(file, options, callback) {
      options = {
        stale: 1e4,
        update: null,
        realpath: true,
        retries: 0,
        fs,
        onCompromised: (err) => {
          throw err;
        },
        ...options
      };
      options.retries = options.retries || 0;
      options.retries = typeof options.retries === "number" ? { retries: options.retries } : options.retries;
      options.stale = Math.max(options.stale || 0, 2e3);
      options.update = options.update == null ? options.stale / 2 : options.update || 0;
      options.update = Math.max(Math.min(options.update, options.stale / 2), 1e3);
      resolveCanonicalPath(file, options, (err, file2) => {
        if (err) {
          return callback(err);
        }
        const operation = retry.operation(options.retries);
        operation.attempt(() => {
          acquireLock(file2, options, (err2, mtime, mtimePrecision2) => {
            if (operation.retry(err2)) {
              return;
            }
            if (err2) {
              return callback(operation.mainError());
            }
            const lock2 = locks[file2] = {
              lockfilePath: getLockFile(file2, options),
              mtime,
              mtimePrecision: mtimePrecision2,
              options,
              lastUpdate: Date.now()
            };
            updateLock(file2, options);
            callback(null, (releasedCallback) => {
              if (lock2.released) {
                return releasedCallback && releasedCallback(Object.assign(new Error("Lock is already released"), { code: "ERELEASED" }));
              }
              unlock(file2, { ...options, realpath: false }, releasedCallback);
            });
          });
        });
      });
    }
    function unlock(file, options, callback) {
      options = {
        fs,
        realpath: true,
        ...options
      };
      resolveCanonicalPath(file, options, (err, file2) => {
        if (err) {
          return callback(err);
        }
        const lock2 = locks[file2];
        if (!lock2) {
          return callback(Object.assign(new Error("Lock is not acquired/owned by you"), { code: "ENOTACQUIRED" }));
        }
        lock2.updateTimeout && clearTimeout(lock2.updateTimeout);
        lock2.released = true;
        delete locks[file2];
        removeLock(file2, options, callback);
      });
    }
    function check(file, options, callback) {
      options = {
        stale: 1e4,
        realpath: true,
        fs,
        ...options
      };
      options.stale = Math.max(options.stale || 0, 2e3);
      resolveCanonicalPath(file, options, (err, file2) => {
        if (err) {
          return callback(err);
        }
        options.fs.stat(getLockFile(file2, options), (err2, stat2) => {
          if (err2) {
            return err2.code === "ENOENT" ? callback(null, false) : callback(err2);
          }
          return callback(null, !isLockStale(stat2, options));
        });
      });
    }
    function getLocks() {
      return locks;
    }
    onExit(() => {
      for (const file in locks) {
        const options = locks[file].options;
        try {
          options.fs.rmdirSync(getLockFile(file, options));
        } catch (e) {
        }
      }
    });
    module.exports.lock = lock;
    module.exports.unlock = unlock;
    module.exports.check = check;
    module.exports.getLocks = getLocks;
  }
});

// node_modules/proper-lockfile/lib/adapter.js
var require_adapter = __commonJS({
  "node_modules/proper-lockfile/lib/adapter.js"(exports, module) {
    "use strict";
    var fs = require_graceful_fs();
    function createSyncFs(fs2) {
      const methods = ["mkdir", "realpath", "stat", "rmdir", "utimes"];
      const newFs = { ...fs2 };
      methods.forEach((method) => {
        newFs[method] = (...args) => {
          const callback = args.pop();
          let ret;
          try {
            ret = fs2[`${method}Sync`](...args);
          } catch (err) {
            return callback(err);
          }
          callback(null, ret);
        };
      });
      return newFs;
    }
    function toPromise(method) {
      return (...args) => new Promise((resolve2, reject) => {
        args.push((err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve2(result);
          }
        });
        method(...args);
      });
    }
    function toSync(method) {
      return (...args) => {
        let err;
        let result;
        args.push((_err, _result) => {
          err = _err;
          result = _result;
        });
        method(...args);
        if (err) {
          throw err;
        }
        return result;
      };
    }
    function toSyncOptions(options) {
      options = { ...options };
      options.fs = createSyncFs(options.fs || fs);
      if (typeof options.retries === "number" && options.retries > 0 || options.retries && typeof options.retries.retries === "number" && options.retries.retries > 0) {
        throw Object.assign(new Error("Cannot use retries with the sync api"), { code: "ESYNC" });
      }
      return options;
    }
    module.exports = {
      toPromise,
      toSync,
      toSyncOptions
    };
  }
});

// node_modules/proper-lockfile/index.js
var require_proper_lockfile = __commonJS({
  "node_modules/proper-lockfile/index.js"(exports, module) {
    "use strict";
    var lockfile = require_lockfile();
    var { toPromise, toSync, toSyncOptions } = require_adapter();
    async function lock(file, options) {
      const release = await toPromise(lockfile.lock)(file, options);
      return toPromise(release);
    }
    function lockSync(file, options) {
      const release = toSync(lockfile.lock)(file, toSyncOptions(options));
      return toSync(release);
    }
    function unlock(file, options) {
      return toPromise(lockfile.unlock)(file, options);
    }
    function unlockSync(file, options) {
      return toSync(lockfile.unlock)(file, toSyncOptions(options));
    }
    function check(file, options) {
      return toPromise(lockfile.check)(file, options);
    }
    function checkSync(file, options) {
      return toSync(lockfile.check)(file, toSyncOptions(options));
    }
    module.exports = lock;
    module.exports.lock = lock;
    module.exports.unlock = unlock;
    module.exports.lockSync = lockSync;
    module.exports.unlockSync = unlockSync;
    module.exports.check = check;
    module.exports.checkSync = checkSync;
  }
});

// scripts/lib/history.mjs
var import_proper_lockfile = __toESM(require_proper_lockfile(), 1);
import { constants } from "node:fs";
import { appendFile, copyFile, link, mkdir, open, readdir, readFile, stat, unlink, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
var POSITIVE = /* @__PURE__ */ new Set(["AVAILABLE", "LIKELY_AVAILABLE"]);
var NEGATIVE = "NOT_AVAILABLE";
var FORECAST_WINDOW_MAX_DAYS = 28;
var EVENT_KINDS = /* @__PURE__ */ new Set(["SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"]);
var DAY_FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
var ACTIVITY_KEYS = { source: "s", productKey: "p", gradeLabel: "g", kind: "k", status: "st", observedAt: "o", resumedAt: "r", latestEventAt: "l", windowMinutes: "w", count: "c", gradeSpecific: "gs", sourceTerminology: "t" };
var ACTIVITY_FIELDS = Object.fromEntries(Object.entries(ACTIVITY_KEYS).map(([field, alias]) => [alias, field]));
var packActivity = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0).map(([field, item]) => [ACTIVITY_KEYS[field] ?? field, item]));
var unpackActivity = (value) => Object.fromEntries(Object.entries(value).map(([alias, item]) => [ACTIVITY_FIELDS[alias] ?? alias, item]));
function forecastWindowDays(config) {
  return Math.min(config.history.retentionDays, FORECAST_WINDOW_MAX_DAYS);
}
function historyLayout(path) {
  const base = path.endsWith(".json") ? path.slice(0, -5) : path;
  return { manifest: path, ticksDir: `${base}.ticks`, stations: `${base}.stations.json`, v1Backup: `${base}.v1-backup.json` };
}
function defaultHistoryPath(env = process.env) {
  return historyPath(env);
}
async function ensureDefaultHistoryPath(env = process.env) {
  const target = defaultHistoryPath(env);
  if (env.FUEL_WATCH_HISTORY_PATH) return target;
  const legacyRoot = env.XDG_STATE_HOME ? resolve(env.XDG_STATE_HOME) : join(env.HOME || homedir(), ".local", "state");
  const legacy = join(legacyRoot, "fuel-watch", "history.json");
  await mkdir(dirname(target), { recursive: true, mode: 448 });
  try {
    await copyFile(legacy, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!["ENOENT", "EEXIST"].includes(error.code)) throw error;
  }
  return target;
}
async function recordHistory(path, snapshot, config, { lock = import_proper_lockfile.default.lock } = {}) {
  return withHistoryLock(path, async (assertLockHealthy) => {
    const now = new Date(snapshot.fetchedAt);
    if (!Number.isFinite(now.getTime())) throw new Error("snapshot fetchedAt is invalid");
    const retentionDays = config.history.retentionDays;
    const windowDays = forecastWindowDays(config);
    const layout = historyLayout(path);
    const manifest = await loadManifest(layout, assertLockHealthy);
    const referenceMs = Math.max(now.getTime(), new Date(manifest.updatedAt ?? 0).getTime() || 0);
    const cutoff = referenceMs - retentionDays * 864e5;
    const windowCutoff = Math.max(cutoff, referenceMs - windowDays * 864e5);
    const dictionary = await loadStationDictionary(layout);
    const recent = (await readTickFiles(layout, { sinceMs: windowCutoff, dictionary })).ticks;
    const tick = compactTick(snapshot, cutoff);
    const duplicate = recent.some((value) => value.fetchedAt === tick.fetchedAt && value.areaHash === tick.areaHash && value.queryHash === tick.queryHash);
    for (const [key, value] of Object.entries(dictionary.stations)) if (new Date(value.lastSeenAt).getTime() < cutoff) delete dictionary.stations[key];
    if (!duplicate) rememberStations(dictionary, tick);
    assertLockHealthy();
    await writeJsonAtomic(layout.stations, dictionary);
    if (!duplicate) {
      await appendLine(join(layout.ticksDir, `${dayKey(tick.fetchedAt)}.jsonl`), storedTick(tick, seenEvents(recent), dictionary));
      recent.push(tick);
    }
    await pruneDayFiles(layout, cutoff);
    const updatedAt = new Date(Math.max(referenceMs, now.getTime())).toISOString();
    assertLockHealthy();
    await writeJsonAtomic(layout.manifest, { schemaVersion: 2, layout: "daily-jsonl", retentionDays, updatedAt });
    assertLockHealthy();
    recent.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
    const history = { schemaVersion: 2, retentionDays, windowDays, updatedAt, ticks: recent.filter((value) => new Date(value.fetchedAt).getTime() >= windowCutoff) };
    const forecast = buildForecast(history, snapshot, config, { windowDays });
    return { history, forecast };
  }, lock);
}
async function readHistory(path, { sinceMs = -Infinity } = {}) {
  const layout = historyLayout(path);
  let manifest;
  try {
    manifest = await readJson(layout.manifest);
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 2, ticks: [], corruptLines: 0, stations: {} };
    throw error;
  }
  if (manifest.schemaVersion === 1 && Array.isArray(manifest.ticks)) return { ...manifest, ticks: manifest.ticks.filter((tick) => new Date(tick.fetchedAt).getTime() >= sinceMs), corruptLines: 0, stations: {} };
  if (manifest.schemaVersion !== 2) throw new Error("unsupported history schema");
  const dictionary = await readerDictionary(layout);
  const { ticks, corruptLines } = await readTickFiles(layout, { sinceMs, dictionary });
  ticks.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
  return { ...manifest, ticks, corruptLines, stations: dictionary.stations };
}
async function forEachHistoryDay(path, { sinceMs: requestedSinceMs = -Infinity } = {}, visit) {
  const layout = historyLayout(path);
  const manifest = await readJson(layout.manifest).catch((error) => {
    if (error.code === "ENOENT") return void 0;
    throw error;
  });
  if (!manifest) return { days: 0, corruptLines: 0, stations: {} };
  const retainedSinceMs = Date.parse(manifest.updatedAt) - manifest.retentionDays * 864e5;
  const sinceMs = Number.isFinite(retainedSinceMs) ? Math.max(requestedSinceMs, retainedSinceMs) : requestedSinceMs;
  if (manifest.schemaVersion === 1) {
    const value = await readHistory(path, { sinceMs });
    await visit(value.ticks, "legacy");
    return { days: 1, corruptLines: 0, stations: {} };
  }
  const dictionary = await readerDictionary(layout);
  let corruptLines = 0, days = 0;
  for (const day of await dayFiles(layout)) {
    if (day.endMs < sinceMs) continue;
    const parsed = await readDayFile(join(layout.ticksDir, day.name), dictionary);
    corruptLines += parsed.corruptLines;
    days += 1;
    await visit(parsed.ticks.filter((tick) => new Date(tick.fetchedAt).getTime() >= sinceMs).sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt)), day.key);
  }
  return { days, corruptLines, stations: dictionary.stations };
}
async function loadManifest(layout, assertLockHealthy) {
  let value;
  try {
    value = await readJson(layout.manifest);
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 2 };
    throw error;
  }
  if (value.schemaVersion === 2) return value;
  if (value.schemaVersion !== 1 || !Array.isArray(value.ticks)) throw new Error("unsupported history schema");
  return migrateV1(layout, value, assertLockHealthy);
}
async function migrateV1(layout, legacy, assertLockHealthy) {
  const temp = `${layout.v1Backup}.${process.pid}.${randomUUID()}.tmp`;
  await copyFile(layout.manifest, temp);
  try {
    await link(temp, layout.v1Backup);
  } catch (error) {
    if (error.code === "EEXIST") {
    } else if (["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS", "EXDEV"].includes(error.code)) {
      if (!await stat(layout.v1Backup).catch(() => void 0)) await rename(temp, layout.v1Backup);
    } else throw error;
  } finally {
    await unlink(temp).catch(() => {
    });
  }
  const dictionary = { schemaVersion: 1, stations: {} };
  const byDay = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Map();
  for (const tick of [...legacy.ticks].sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt))) {
    if (!Number.isFinite(new Date(tick.fetchedAt).getTime())) continue;
    rememberStations(dictionary, tick);
    const stored = storedTick(tick, seen, dictionary);
    for (const station of tick.stations ?? []) for (const value of station.activity ?? []) if (EVENT_KINDS.has(value.kind)) eventSet(seen, eventScope(tick, station)).add(eventKey(value));
    const key = dayKey(tick.fetchedAt);
    byDay.set(key, `${byDay.get(key) ?? ""}${JSON.stringify(stored)}
`);
  }
  await mkdir(layout.ticksDir, { recursive: true, mode: 448 });
  for (const [key, text] of byDay) await writeTextAtomic(join(layout.ticksDir, `${key}.jsonl`), text);
  assertLockHealthy();
  await writeJsonAtomic(layout.stations, dictionary);
  const manifest = { schemaVersion: 2, layout: "daily-jsonl", retentionDays: legacy.retentionDays, updatedAt: legacy.updatedAt, migratedFromV1At: (/* @__PURE__ */ new Date()).toISOString() };
  await writeJsonAtomic(layout.manifest, manifest);
  return manifest;
}
async function readerDictionary(layout) {
  const dictionary = await loadStationDictionary(layout);
  dictionary.refresh = async () => {
    dictionary.refresh = void 0;
    dictionary.stations = (await loadStationDictionary(layout)).stations;
  };
  return dictionary;
}
async function loadStationDictionary(layout) {
  try {
    const value = await readJson(layout.stations);
    return value && typeof value.stations === "object" && value.stations ? value : { schemaVersion: 1, stations: {} };
  } catch (error) {
    if (error.code === "ENOENT") return { schemaVersion: 1, stations: {} };
    throw error;
  }
}
function rememberStations(dictionary, tick) {
  for (const station of tick.stations ?? []) {
    if (!station.stationKey) continue;
    const old = dictionary.stations[station.stationKey];
    const newer = !old || new Date(tick.fetchedAt) >= new Date(old.lastSeenAt);
    const labels = old?.labels ?? (old ? [[old.title ?? null, old.brand ?? null]] : []);
    if (labelIndex(labels, station) < 0) labels.push([station.title ?? null, station.brand ?? null]);
    dictionary.stations[station.stationKey] = {
      title: newer ? station.title ?? old?.title : old.title,
      address: newer ? station.address ?? old?.address : old.address,
      brand: newer ? station.brand ?? old?.brand : old.brand,
      coordinate: newer ? station.coordinate ?? old?.coordinate : old.coordinate,
      firstSeenAt: old && new Date(old.firstSeenAt) < new Date(tick.fetchedAt) ? old.firstSeenAt : tick.fetchedAt,
      lastSeenAt: newer ? tick.fetchedAt : old.lastSeenAt,
      labels
    };
  }
}
function labelIndex(labels, station) {
  return labels.findIndex(([title, brand]) => title === (station.title ?? null) && brand === (station.brand ?? null));
}
function storedTick(tick, seen, dictionary) {
  return {
    fetchedAt: tick.fetchedAt,
    areaHash: tick.areaHash,
    queryHash: tick.queryHash,
    ...tick.sources ? { sources: tick.sources } : {},
    stations: (tick.stations ?? []).map((station) => {
      const known = seen.get(eventScope(tick, station));
      const activity = (station.activity ?? []).filter((value) => !(EVENT_KINDS.has(value.kind) && known?.has(eventKey(value)))).map(packActivity);
      const label = labelIndex(dictionary.stations[station.stationKey]?.labels ?? [], station);
      return { stationKey: station.stationKey, memberKeys: station.memberKeys, verdict: station.verdict, confidence: station.confidence, ...label > 0 ? { label } : {}, activity };
    })
  };
}
function seenEvents(ticks) {
  const seen = /* @__PURE__ */ new Map();
  for (const tick of ticks) for (const station of tick.stations ?? []) for (const value of station.activity ?? []) if (EVENT_KINDS.has(value.kind)) eventSet(seen, eventScope(tick, station)).add(eventKey(value));
  return seen;
}
function eventScope(tick, station) {
  return JSON.stringify([tick.areaHash ?? null, tick.queryHash ?? null, station.stationKey ?? null]);
}
function eventKey(value) {
  return JSON.stringify(Object.keys(ACTIVITY_KEYS).map((field) => value[field] ?? null));
}
function eventSet(map, key) {
  if (!map.has(key)) map.set(key, /* @__PURE__ */ new Set());
  return map.get(key);
}
function rehydrate(stored, dictionary) {
  return { ...stored, stations: (stored.stations ?? []).map(({ label, ...station }) => {
    const meta = dictionary.stations[station.stationKey] ?? {};
    const [title, brand] = meta.labels?.[label ?? 0] ?? [meta.title, meta.brand];
    return { ...station, title: title ?? void 0, address: meta.address, brand: brand ?? void 0, coordinate: meta.coordinate, activity: (station.activity ?? []).map(unpackActivity) };
  }) };
}
async function dayFiles(layout) {
  let names;
  try {
    names = await readdir(layout.ticksDir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return names.map((name) => name.match(DAY_FILE)).filter(Boolean).map((match) => ({ name: match[0], key: match[1], endMs: Date.parse(`${match[1]}T00:00:00Z`) + 864e5 })).sort((a, b) => a.key.localeCompare(b.key));
}
async function readTickFiles(layout, { sinceMs, dictionary }) {
  const ticks = [];
  let corruptLines = 0;
  for (const day of await dayFiles(layout)) {
    if (day.endMs < sinceMs) continue;
    const parsed = await readDayFile(join(layout.ticksDir, day.name), dictionary);
    corruptLines += parsed.corruptLines;
    for (const tick of parsed.ticks) if (new Date(tick.fetchedAt).getTime() >= sinceMs) ticks.push(tick);
  }
  return { ticks, corruptLines };
}
async function readDayFile(path, dictionary) {
  const ticks = [];
  let corruptLines = 0;
  const text = await readFile(path, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const stored = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const value = JSON.parse(line);
      if (Array.isArray(value?.stations) && value.fetchedAt) stored.push(value);
      else corruptLines += 1;
    } catch {
      corruptLines += 1;
    }
  }
  if (dictionary.refresh && stored.some((value) => value.stations.some((station) => station.stationKey && !dictionary.stations[station.stationKey]))) await dictionary.refresh();
  for (const value of stored) ticks.push(rehydrate(value, dictionary));
  return { ticks, corruptLines };
}
async function appendLine(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 448 });
  let separator = "";
  try {
    const handle = await open(path, "r");
    try {
      const { size } = await handle.stat();
      if (size > 0) {
        const last = Buffer.alloc(1);
        await handle.read(last, 0, 1, size - 1);
        if (last[0] !== 10) separator = "\n";
      }
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await appendFile(path, `${separator}${JSON.stringify(value)}
`, { mode: 384 });
}
async function pruneDayFiles(layout, cutoffMs) {
  for (const day of await dayFiles(layout)) if (day.endMs <= cutoffMs) await unlink(join(layout.ticksDir, day.name)).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  const own = `${basename(layout.ticksDir).slice(0, -"ticks".length)}`;
  for (const [directory, prefix] of [[layout.ticksDir, ""], [dirname(layout.manifest), own]]) {
    const names = await readdir(directory).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const name of names.filter((value) => value.startsWith(prefix) && value.endsWith(".tmp"))) {
      const path = join(directory, name);
      const info = await stat(path).catch(() => void 0);
      if (info?.isFile() && Date.now() - info.mtimeMs > 36e5) await unlink(path).catch(() => {
      });
    }
  }
}
async function writeTextAtomic(path, text) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, text, { mode: 384 });
  await rename(temp, path);
}
function dayKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}
async function withHistoryLock(path, operation, lock) {
  const lockPath = `${path}.lock`;
  const reclaimPath = `${lockPath}.reclaim`;
  await mkdir(dirname(path), { recursive: true, mode: 448 });
  await recoverLegacyFileLock(reclaimPath);
  await recoverLegacyFileLock(lockPath);
  let release;
  let compromised;
  const assertLockHealthy = () => {
    if (compromised) throw Object.assign(new Error(`History lock was compromised: ${compromised.message ?? compromised}`), { code: "HISTORY_LOCK_COMPROMISED", cause: compromised });
  };
  try {
    release = await lock(path, { realpath: false, stale: 3e4, update: 1e4, retries: { retries: 250, factor: 1, minTimeout: 20, maxTimeout: 20, randomize: false }, onCompromised: (error) => {
      compromised ??= error;
    } });
  } catch (error) {
    if (error.code === "ELOCKED") throw Object.assign(new Error(`Timed out waiting for history lock: ${lockPath}`), { code: "HISTORY_LOCK_TIMEOUT", cause: error });
    throw error;
  }
  try {
    assertLockHealthy();
    return await operation(assertLockHealthy);
  } finally {
    try {
      await release();
    } catch (error) {
      if (!compromised || !["ERELEASED", "ENOTACQUIRED"].includes(error.code)) throw error;
    } finally {
      assertLockHealthy();
    }
  }
}
async function recoverLegacyFileLock(path) {
  const [raw, info] = await Promise.all([readFile(path, "utf8"), stat(path)]).catch((error) => error.code === "ENOENT" || error.code === "EISDIR" ? [] : Promise.reject(error));
  if (!raw || !info?.isFile()) return;
  let holder;
  try {
    holder = JSON.parse(raw);
  } catch {
    holder = void 0;
  }
  const recoverable = Number.isInteger(holder?.pid) ? !isProcessAlive(holder.pid) : Date.now() - info.mtimeMs > 3e4;
  if (recoverable) await unlink(path).catch((error) => {
    if (!["ENOENT", "EISDIR", "EPERM"].includes(error.code)) throw error;
  });
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
function buildForecast(history, snapshot, config, { windowDays = config.history.retentionDays } = {}) {
  const brandAliases = compileBrandAliases(config.identity.brandAliases);
  const nowMs = new Date(snapshot.fetchedAt).getTime();
  const cutoffMs = nowMs - windowDays * 864e5;
  const retainedTicks = history.ticks.filter((tick) => new Date(tick.fetchedAt).getTime() >= cutoffMs);
  const areaTicks = retainedTicks.filter((tick) => tick.areaHash === snapshot.areaHash);
  const scopedTicks = retainedTicks.filter((tick) => tick.areaHash === snapshot.areaHash && tick.queryHash === snapshot.queryHash);
  const identity = buildHistoryIdentity(areaTicks);
  const episodes = completedEpisodes(scopedTicks, config.monitoring.intervalMinutes * 3, identity, brandAliases);
  const rollingEvents = rollingActivityEvents(areaTicks, config, identity, brandAliases);
  const sourceEvents = sourceTimelineEvents(areaTicks, config, identity, brandAliases, cutoffMs, nowMs);
  const statusEvents = petrolStatusEvents(areaTicks, config, identity, brandAliases);
  const candidates = snapshot.assessments.filter((assessment) => assessment.verdict === NEGATIVE && assessment.sellsRequestedFamily !== false).map((assessment) => {
    const samples = stationSamples(scopedTicks, assessment, identity);
    const negativeStartedAt = currentNegativeStart(samples, config.monitoring.intervalMinutes * 3);
    if (!negativeStartedAt) return null;
    const brand = stationBrand(assessment, brandAliases);
    const activity = selectTimePattern(rollingEvents, assessment, brand, identity) ?? selectTimePattern(sourceEvents, assessment, brand, identity) ?? selectTimePattern(statusEvents, assessment, brand, identity);
    if (activity) return forecastFromActivity(assessment, negativeStartedAt, activity, nowMs);
    const selected = selectDurationPattern(episodes, assessment, brand, identity);
    if (!selected) return null;
    return forecastFromStatus(assessment, negativeStartedAt, selected, nowMs);
  }).filter(Boolean).sort((a, b) => new Date(a.expectedAt) - new Date(b.expectedAt)).slice(0, config.history.forecastCount);
  return { generatedAt: snapshot.fetchedAt, retentionDays: config.history.retentionDays, windowDays, requestedCount: config.history.forecastCount, tickCount: areaTicks.length, completedEpisodeCount: episodes.length, activityEventCount: rollingEvents.length, sourceTimelineEventCount: sourceEvents.length, petrolStatusEventCount: statusEvents.length, items: candidates };
}
function compactTick(snapshot, cutoffMs = -Infinity) {
  const keepActivity = (value) => {
    if (!["ROLLING_SIGNAL_COUNT", "PETROL_STATUS_SNAPSHOT", "SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"].includes(value.kind)) return false;
    if (!["SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"].includes(value.kind)) return true;
    const eventMs = new Date(sourceEventAt(value)).getTime();
    return Number.isFinite(eventMs) && eventMs >= cutoffMs;
  };
  const sources = Array.isArray(snapshot.sourceHealth) ? Object.fromEntries(snapshot.sourceHealth.map((health) => [health.source, health.status])) : void 0;
  return { fetchedAt: snapshot.fetchedAt, areaHash: snapshot.areaHash, queryHash: snapshot.queryHash, ...sources ? { sources } : {}, stations: snapshot.assessments.map((assessment) => ({ stationKey: assessment.stationKey, memberKeys: (assessment.members ?? []).map((member) => `${member.source}:${member.sourceStationId}`).sort(), title: assessment.title, address: assessment.address, brand: assessment.brand, coordinate: assessment.coordinate, verdict: assessment.verdict, confidence: assessment.confidence, activity: (assessment.activity ?? []).filter(keepActivity).map((value) => ({ source: value.source, productKey: value.product?.productKey, gradeLabel: value.gradeLabel, kind: value.kind, status: value.status, observedAt: value.observedAt, resumedAt: value.resumedAt, latestEventAt: value.latestEventAt, windowMinutes: value.windowMinutes, count: value.count, gradeSpecific: value.gradeSpecific, sourceTerminology: value.sourceTerminology })) })) };
}
function sourceTimelineEvents(ticks, config, identity, brandAliases, cutoffMs, nowMs) {
  const rawEvents = [];
  const seen = /* @__PURE__ */ new Set();
  for (const tick of ticks) for (const station of identity.stations(tick)) for (const summary of station.activity ?? []) {
    if (!["SOURCE_REPORTED_TRANSITION", "TRANSACTIONS_RESUMED"].includes(summary.kind) || !summary.gradeSpecific) continue;
    const grade = petrolOctaneKey(summary);
    const at = sourceEventAt(summary);
    const atMs = new Date(at).getTime();
    if (!grade || !Number.isFinite(atMs) || atMs < cutoffMs || atMs > nowMs + config.freshness.futureSkewSeconds * 1e3) continue;
    const identityId = identity.id(station);
    const eventKey2 = `${identityId}|${summary.source}|${grade}|${new Date(atMs).toISOString()}`;
    if (seen.has(eventKey2)) continue;
    seen.add(eventKey2);
    rawEvents.push({ identityId, brand: stationBrand(station, brandAliases), atMs, grade, source: summary.source, kind: summary.kind });
  }
  const clusterGapMs = Math.max(config.activity.resumeWindowMinutes, config.activity.quietGapMinutes * 2) * 6e4;
  const clusters = [];
  for (const event of rawEvents.sort((a, b) => a.identityId.localeCompare(b.identityId) || a.atMs - b.atMs)) {
    const current = clusters.at(-1);
    if (!current || current.identityId !== event.identityId || event.atMs - current.lastAtMs > clusterGapMs) clusters.push({ identityId: event.identityId, brand: event.brand, atMs: event.atMs, lastAtMs: event.atMs, grades: /* @__PURE__ */ new Set([event.grade]), sources: /* @__PURE__ */ new Set([event.source]), kinds: /* @__PURE__ */ new Set([event.kind]) });
    else {
      current.lastAtMs = Math.max(current.lastAtMs, event.atMs);
      current.grades.add(event.grade);
      current.sources.add(event.source);
      current.kinds.add(event.kind);
    }
  }
  return clusters.map((value) => ({ identityId: value.identityId, brand: value.brand, at: new Date(value.atMs).toISOString(), gradeCount: value.grades.size, confidence: value.grades.size >= 2 || value.sources.size >= 2 ? "MEDIUM" : "LOW", signalBasis: value.kinds.has("TRANSACTIONS_RESUMED") ? "SOURCE_ACTIVITY_TIMELINE" : "SOURCE_REPORTED_STATUS" }));
}
function rollingActivityEvents(ticks, config, identity, brandAliases) {
  const previous = /* @__PURE__ */ new Map();
  const groups = /* @__PURE__ */ new Map();
  for (const tick of ticks) for (const station of identity.stations(tick)) for (const summary of aggregateRollingByOctane(station.activity)) {
    const grade = summary.grade;
    const identityId = identity.id(station);
    const key = `${identityId}|${summary.source}|${grade}`;
    const before = previous.get(key);
    const tickMs = new Date(tick.fetchedAt).getTime();
    const latestMs = new Date(summary.latestEventAt).getTime();
    const closeTicks = before && tickMs - before.tickMs <= config.monitoring.intervalMinutes * 3 * 6e4;
    const recentEvent = Number.isFinite(latestMs) && tickMs - latestMs >= -config.freshness.futureSkewSeconds * 1e3 && tickMs - latestMs <= config.activity.resumeWindowMinutes * 6e4;
    const witnessed = before && [...summary.variantCounts].some(([variant, count]) => count > 0 && before.summary.variantCounts.get(variant) === 0);
    if (closeTicks && witnessed && before.summary.windowMinutes >= config.activity.quietGapMinutes && before.summary.count === 0 && summary.count >= config.activity.minimumEvents && recentEvent) {
      const groupKey = `${identityId}|${tick.fetchedAt}`;
      const group = groups.get(groupKey) ?? { identityId, brand: stationBrand(station, brandAliases), at: summary.latestEventAt, grades: /* @__PURE__ */ new Set(), totalCount: 0 };
      group.grades.add(grade);
      group.totalCount += summary.count;
      if (new Date(summary.latestEventAt) > new Date(group.at)) group.at = summary.latestEventAt;
      groups.set(groupKey, group);
    }
    previous.set(key, { tickMs, summary });
  }
  return [...groups.values()].map((value) => ({ identityId: value.identityId, brand: value.brand, at: value.at, gradeCount: value.grades.size, totalCount: value.totalCount, confidence: value.grades.size >= 2 || value.totalCount >= config.activity.strongSignalCountPerHour ? "MEDIUM" : "LOW", signalBasis: "ROLLING_ACTIVITY" }));
}
function petrolStatusEvents(ticks, config, identity, brandAliases) {
  const previous = /* @__PURE__ */ new Map();
  const groups = /* @__PURE__ */ new Map();
  for (const tick of ticks) for (const station of identity.stations(tick)) for (const summary of aggregateStatusesByOctane(station.activity)) {
    const grade = summary.grade;
    const identityId = identity.id(station);
    const key = `${identityId}|${summary.source}|${grade}`;
    const before = previous.get(key);
    const tickMs = new Date(tick.fetchedAt).getTime();
    const closeTicks = before && tickMs - before.tickMs <= config.monitoring.intervalMinutes * 3 * 6e4;
    const witnessed = before && [...summary.variantStatuses].some(([variant, status]) => ["IN_STOCK", "LIMITED"].includes(status) && before.summary.variantStatuses.get(variant) === "OUT_OF_STOCK");
    if (closeTicks && witnessed && before.summary.status === "OUT_OF_STOCK" && ["IN_STOCK", "LIMITED"].includes(summary.status)) {
      const groupKey = `${identityId}|${tick.fetchedAt}`;
      const group = groups.get(groupKey) ?? { identityId, brand: stationBrand(station, brandAliases), at: tick.fetchedAt, grades: /* @__PURE__ */ new Set() };
      group.grades.add(grade);
      groups.set(groupKey, group);
    }
    previous.set(key, { tickMs, summary });
  }
  return [...groups.values()].map((value) => ({ identityId: value.identityId, brand: value.brand, at: value.at, gradeCount: value.grades.size, confidence: value.grades.size >= 2 ? "MEDIUM" : "LOW", signalBasis: "PETROL_STATUS_PATTERN" }));
}
function aggregateRollingByOctane(activity = []) {
  const grouped = /* @__PURE__ */ new Map();
  for (const summary of activity) {
    if (!summary.gradeSpecific || !Number.isFinite(summary.count) || !Number.isFinite(summary.windowMinutes)) continue;
    const grade = petrolOctaneKey(summary);
    if (!grade) continue;
    const key = `${summary.source}\0${grade}`;
    const aggregate = grouped.get(key) ?? { source: summary.source, grade, count: 0, windowMinutes: Infinity, latestEventAt: void 0, variantCounts: /* @__PURE__ */ new Map() };
    aggregate.count += summary.count;
    aggregate.windowMinutes = Math.min(aggregate.windowMinutes, summary.windowMinutes);
    if (isLaterTimestamp(summary.latestEventAt, aggregate.latestEventAt)) aggregate.latestEventAt = summary.latestEventAt;
    const variant = activityVariantKey(summary);
    if (variant) aggregate.variantCounts.set(variant, (aggregate.variantCounts.get(variant) ?? 0) + summary.count);
    grouped.set(key, aggregate);
  }
  return [...grouped.values()];
}
function aggregateStatusesByOctane(activity = []) {
  const grouped = /* @__PURE__ */ new Map();
  for (const summary of activity) {
    if (summary.kind !== "PETROL_STATUS_SNAPSHOT" || !summary.gradeSpecific) continue;
    const grade = petrolOctaneKey(summary);
    if (!grade) continue;
    const key = `${summary.source}\0${grade}`;
    const aggregate = grouped.get(key) ?? { source: summary.source, grade, statuses: [], variantStatuses: /* @__PURE__ */ new Map() };
    aggregate.statuses.push(summary.status);
    const variant = activityVariantKey(summary);
    if (variant) aggregate.variantStatuses.set(variant, strongestStatus([aggregate.variantStatuses.get(variant), summary.status]));
    grouped.set(key, aggregate);
  }
  return [...grouped.values()].map((value) => ({
    source: value.source,
    grade: value.grade,
    status: strongestStatus(value.statuses),
    variantStatuses: value.variantStatuses
  }));
}
function strongestStatus(statuses) {
  return statuses.includes("IN_STOCK") ? "IN_STOCK" : statuses.includes("LIMITED") ? "LIMITED" : statuses.includes("OUT_OF_STOCK") ? "OUT_OF_STOCK" : "UNKNOWN";
}
function activityVariantKey(summary) {
  const explicit = summary.productKey ?? summary.product?.productKey ?? summary.variantKey ?? summary.product?.variantKey;
  if (explicit && explicit !== "AI95_UNKNOWN") return String(explicit);
  const label = normalizeFuelLabel(summary.gradeLabel ?? summary.product?.displayLabel ?? "");
  return label || (explicit ? String(explicit) : void 0);
}
function isLaterTimestamp(candidate, current) {
  const candidateMs = new Date(candidate).getTime();
  if (!Number.isFinite(candidateMs)) return false;
  const currentMs = new Date(current).getTime();
  return !Number.isFinite(currentMs) || candidateMs > currentMs;
}
function sourceEventAt(value) {
  return value.kind === "SOURCE_REPORTED_TRANSITION" ? value.observedAt : value.resumedAt ?? value.latestEventAt;
}
function scopedPatterns(values, station, brand, identity) {
  const stationIdentity = identity.id(station);
  return [
    { values: values.filter((value) => value.identityId === stationIdentity), basis: "STATION" },
    { values: values.filter((value) => brand && value.brand === brand), basis: "BRAND" },
    { values, basis: "AREA" }
  ];
}
function selectTimePattern(values, station, brand, identity) {
  const [stationValues, matchingBrand, areaValues] = scopedPatterns(values, station, brand, identity);
  if (spansTwoMoscowDays(stationValues.values)) return stationValues;
  if (spansTwoMoscowDays(matchingBrand.values)) return matchingBrand;
  if (spansTwoMoscowDays(areaValues.values)) return areaValues;
  return null;
}
function selectDurationPattern(values, station, brand, identity) {
  return scopedPatterns(values, station, brand, identity).find((value) => value.values.length >= 2) ?? null;
}
function spansTwoMoscowDays(values) {
  return values.length >= 2 && new Set(values.map((value) => value.at ?? value.transitionAt).map((value) => {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? new Date(ms + 3 * 36e5).toISOString().slice(0, 10) : void 0;
  }).filter(Boolean)).size >= 2;
}
function forecastFromActivity(assessment, negativeStartedAt, selected, nowMs) {
  const minutes = selected.values.map((value) => moscowMinute(value.at));
  const center = minutes.reduce((best, candidate) => minutes.reduce((sum, value) => sum + Math.abs(circularDifference(value, candidate)), 0) < minutes.reduce((sum, value) => sum + Math.abs(circularDifference(value, best)), 0) ? candidate : best, minutes[0]);
  const offsets = minutes.map((value) => circularDifference(value, center)).sort((a, b) => a - b);
  const middle = quantile(offsets, 0.5), low = quantile(offsets, 0.25), high = quantile(offsets, 0.75);
  let expectedMs = nextMoscowMinute(center + middle, nowMs);
  let windowStartMs = expectedMs + (low - middle) * 6e4;
  let windowEndMs = expectedMs + (high - middle) * 6e4;
  if (windowEndMs <= nowMs) {
    expectedMs += 864e5;
    windowStartMs += 864e5;
    windowEndMs += 864e5;
  }
  const strong = selected.values.filter((value) => value.confidence === "MEDIUM").length;
  return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, coordinate: assessment.coordinate, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(expectedMs).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence: selected.basis === "STATION" && selected.values.length >= 3 && strong >= 2 ? "MEDIUM" : "LOW", basis: selected.basis, signalBasis: selected.values[0].signalBasis, sampleSize: selected.values.length };
}
function forecastFromStatus(assessment, negativeStartedAt, selected, nowMs) {
  const durations = selected.values.map((episode) => episode.durationMinutes).sort((a, b) => a - b);
  const expectedMinutes = quantile(durations, 0.5), lowMinutes = quantile(durations, 0.25), highMinutes = quantile(durations, 0.75);
  const startMs = new Date(negativeStartedAt).getTime();
  const expectedMs = startMs + expectedMinutes * 6e4, windowStartMs = startMs + lowMinutes * 6e4, windowEndMs = startMs + highMinutes * 6e4;
  if (windowEndMs <= nowMs) return null;
  const confidence = selected.basis === "STATION" && durations.length >= 3 ? "MEDIUM" : "LOW";
  return { stationKey: assessment.stationKey, title: assessment.title, address: assessment.address, coordinate: assessment.coordinate, brand: assessment.brand, negativeStartedAt, expectedAt: new Date(Math.max(expectedMs, nowMs)).toISOString(), windowStartAt: new Date(Math.max(windowStartMs, nowMs)).toISOString(), windowEndAt: new Date(windowEndMs).toISOString(), confidence, basis: selected.basis, signalBasis: "STATUS_TRANSITION", sampleSize: durations.length };
}
function completedEpisodes(ticks, maxGapMinutes, identity, brandAliases = {}) {
  const out = [];
  for (const [identityId, samples] of identity.groups(ticks)) {
    let negativeStart;
    let previousAt;
    for (const sample of samples) {
      const at = new Date(sample.fetchedAt).getTime();
      if (previousAt && at - previousAt > maxGapMinutes * 6e4) negativeStart = void 0;
      if (sample.verdict === NEGATIVE) negativeStart ??= sample.fetchedAt;
      else if (isConfirmedPositive(sample) && negativeStart) {
        out.push({ identityId, brand: stationBrand(sample, brandAliases), startedAt: negativeStart, transitionAt: sample.fetchedAt, durationMinutes: (at - new Date(negativeStart).getTime()) / 6e4 });
        negativeStart = void 0;
      } else if (!POSITIVE.has(sample.verdict)) negativeStart = void 0;
      previousAt = at;
    }
  }
  return out.filter((episode) => episode.durationMinutes > 0);
}
function currentNegativeStart(samples, maxGapMinutes) {
  let start;
  let previousAt;
  for (const sample of samples) {
    const at = new Date(sample.fetchedAt).getTime();
    if (previousAt && at - previousAt > maxGapMinutes * 6e4) start = void 0;
    if (sample.verdict === NEGATIVE) start ??= sample.fetchedAt;
    else start = void 0;
    previousAt = at;
  }
  return start;
}
function stationSamples(ticks, target, identity) {
  const id = identity.id(target);
  return ticks.flatMap((tick) => {
    const station = identity.stations(tick).find((value) => identity.id(value) === id);
    return station ? [{ ...station, fetchedAt: tick.fetchedAt }] : [];
  });
}
function buildHistoryIdentity(ticks) {
  const records = ticks.flatMap((tick) => tick.stations.map((station) => ({ station, fetchedAt: tick.fetchedAt })));
  const parent = records.map((_, index) => index);
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const unite = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };
  const tokenOwner = /* @__PURE__ */ new Map();
  for (const [index, record] of records.entries()) for (const token of identityTokens(record.station)) {
    if (tokenOwner.has(token)) unite(index, tokenOwner.get(token));
    else tokenOwner.set(token, index);
  }
  const tokenToId = /* @__PURE__ */ new Map();
  for (const [token, index] of tokenOwner) tokenToId.set(token, `history:${find(index)}`);
  const id = (station) => {
    const known = [...new Set(identityTokens(station).map((token) => tokenToId.get(token)).filter(Boolean))];
    return known.length === 1 ? known[0] : known[0] ?? `unlinked:${station.stationKey}`;
  };
  const aggregated = /* @__PURE__ */ new WeakMap();
  const stations = (tick) => {
    if (aggregated.has(tick)) return aggregated.get(tick);
    const grouped = /* @__PURE__ */ new Map();
    for (const station of tick.stations) {
      const key = id(station);
      const values = grouped.get(key) ?? [];
      values.push(station);
      grouped.set(key, values);
    }
    const result = [...grouped.values()].map(aggregateIdentityStations);
    aggregated.set(tick, result);
    return result;
  };
  const groups = (selectedTicks) => {
    const out = /* @__PURE__ */ new Map();
    for (const tick of selectedTicks) for (const station of stations(tick)) {
      const key = id(station);
      const values = out.get(key) ?? [];
      values.push({ ...station, fetchedAt: tick.fetchedAt });
      out.set(key, values);
    }
    for (const values of out.values()) values.sort((a, b) => new Date(a.fetchedAt) - new Date(b.fetchedAt));
    return out;
  };
  return { id, groups, stations };
}
function identityTokens(station) {
  return [...new Set([station.stationKey, ...station.memberKeys ?? [], ...(station.members ?? []).map((member) => `${member.source}:${member.sourceStationId}`)].filter(Boolean))];
}
function aggregateIdentityStations(stations) {
  if (stations.length === 1) return stations[0];
  const verdicts = new Set(stations.map((station) => station.verdict));
  const allConfirmedPositive = stations.every(isConfirmedPositive);
  const allNegative = stations.every((station) => station.verdict === NEGATIVE);
  const confidenceOrder = ["NONE", "LOW", "MEDIUM", "HIGH"];
  const confidence = stations.map((station) => station.confidence).sort((a, b) => confidenceOrder.indexOf(a) - confidenceOrder.indexOf(b))[0] ?? "NONE";
  const verdict = allNegative ? NEGATIVE : allConfirmedPositive ? verdicts.size === 1 ? stations[0].verdict : "LIKELY_AVAILABLE" : "CONFLICTING";
  const representative = stations[0];
  return { ...representative, verdict, confidence, memberKeys: [...new Set(stations.flatMap((station) => station.memberKeys ?? []))].sort(), activity: [...new Map(stations.flatMap((station) => station.activity ?? []).map((value) => [JSON.stringify(value), value])).values()] };
}
function isConfirmedPositive(sample) {
  return sample.verdict === "AVAILABLE" || sample.verdict === "LIKELY_AVAILABLE" && ["MEDIUM", "HIGH"].includes(sample.confidence);
}
function stationBrand(station, aliases = {}) {
  return normalizeComparableBrand(station.brand, aliases) || normalizeBrand(station.title);
}
function quantile(values, q) {
  if (values.length === 1) return values[0];
  const index = (values.length - 1) * q;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return values[lower] + (values[upper] - values[lower]) * (index - lower);
}
function moscowMinute(value) {
  const shifted = new Date(new Date(value).getTime() + 180 * 6e4);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}
function circularDifference(value, center) {
  return (value - center + 2160) % 1440 - 720;
}
function nextMoscowMinute(value, nowMs) {
  const minute = (Math.round(value) % 1440 + 1440) % 1440;
  const localNow = new Date(nowMs + 180 * 6e4);
  let candidate = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, minute) - 180 * 6e4;
  if (candidate <= nowMs) candidate += 864e5;
  return candidate;
}

export {
  forecastWindowDays,
  ensureDefaultHistoryPath,
  recordHistory,
  forEachHistoryDay,
  aggregateIdentityStations,
  isConfirmedPositive
};
