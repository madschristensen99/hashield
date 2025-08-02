// Buffer shim for browser environment
const BufferShim = {
  isBuffer: function() { 
    return false; 
  }
};

// Export the shim
module.exports = { Buffer: BufferShim };
