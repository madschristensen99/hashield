// Browser polyfills for Node.js built-in modules
// This provides empty implementations or browser-compatible alternatives

// fs polyfill (empty implementation)
const fs = {
  readFileSync: () => '',
  writeFileSync: () => {},
  existsSync: () => false,
  mkdirSync: () => {},
  readdirSync: () => [],
  statSync: () => ({ isDirectory: () => false }),
  unlinkSync: () => {},
  rmdirSync: () => {},
  createWriteStream: () => ({
    write: () => {},
    end: () => {},
    on: () => {}
  }),
  createReadStream: () => ({
    pipe: () => ({}),
    on: () => {}
  })
};

// path polyfill (minimal implementation)
const path = {
  join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
  resolve: (...parts) => parts.join('/').replace(/\/+/g, '/'),
  dirname: (path) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '.';
  },
  basename: (path, ext) => {
    let base = path.split('/').pop();
    if (ext && base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
    }
    return base;
  },
};

// assert polyfill (minimal implementation)
const assert = function(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
};

assert.strictEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
};

assert.deepStrictEqual = (actual, expected, message) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Objects are not equal`);
  }
};

// http/https polyfill (using fetch)
const createHttpModule = (protocol) => {
  return {
    request: (options, callback) => {
      const url = `${protocol}://${options.hostname}${options.port ? ':' + options.port : ''}${options.path}`;
      
      const req = {
        write: (data) => {
          req.body = data;
        },
        end: () => {
          fetch(url, {
            method: options.method || 'GET',
            headers: options.headers,
            body: req.body
          })
          .then(response => {
            const res = {
              statusCode: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              on: (event, handler) => {
                if (event === 'data') {
                  response.text().then(text => handler(text));
                }
                if (event === 'end') {
                  setTimeout(handler, 10);
                }
              }
            };
            callback(res);
          })
          .catch(err => {
            const req = {
              on: (event, handler) => {
                if (event === 'error') {
                  handler(err);
                }
              }
            };
          });
        },
        on: () => {}
      };
      
      return req;
    }
  };
};

const http = createHttpModule('http');
const https = createHttpModule('https');

// child_process polyfill (empty implementation)
const child_process = {
  spawn: () => ({
    on: () => {},
    stdout: { on: () => {} },
    stderr: { on: () => {} }
  }),
  exec: (cmd, options, callback) => {
    if (callback) {
      callback(new Error('child_process.exec is not supported in browser environments'), null, null);
    }
    return {
      on: () => {}
    };
  }
};

// Export all modules
module.exports = fs;
module.exports = path;
module.exports = assert;
module.exports = http;
module.exports = https;
module.exports = child_process;

// Make sure they're available as named exports too
module.exports.fs = fs;
module.exports.path = path;
module.exports.assert = assert;
module.exports.http = http;
module.exports.https = https;
module.exports.child_process = child_process;

// Make sure default export works too
module.exports.default = {
  fs,
  path,
  assert,
  http,
  https,
  child_process
};
