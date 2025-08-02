const fs = require('fs');
const path = require('path');

// Plugin to handle Node.js built-in modules in browser environment
const nodeBuiltinsPlugin = {
  name: 'node-builtins',
  setup(build) {
    // Handle Node.js built-in modules
    build.onResolve({ filter: /^(path|fs|assert|http|https|child_process|crypto|os|util|stream|events|buffer)$/ }, args => {
      return { path: path.join(__dirname, 'node_modules', 'browserify-' + args.path, 'index.js') };
    });
  }
};

module.exports = {
  nodeBuiltinsPlugin
};
