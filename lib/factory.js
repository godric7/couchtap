var util  = require('util');

// function createStruct(buffer, fields) {
//   if (!buffer)
//     buffer = new Buffer(buffer)
//   for (var key in fields)
    
// }

function createHeader(buffer)  {
  if (!(buffer instanceof Buffer) || buffer.length != 24) {
    buffer = new Buffer(24)
    buffer.fill(0, 0, 24)
  }
  Object.defineProperties(buffer, {
    'magic' : {
      enumerable: true,
      get: function () { return this.readUInt8(0); },
      set: function (val) { this.writeUInt8(val, 0); },
    },
    'opcode' : {
      enumerable: true,
      get: function () { return this.readUInt8(1); },
      set: function (val) { this.writeUInt8(val, 1); },
    },
    'keyLength' : {
      enumerable: true,
      get: function () { return this.readUInt16BE(2); },
      set: function (val) { this.writeUInt16BE(val, 2); },
    },
    'extrasLength' : {
      enumerable: true,
      get: function () { return this.readUInt8(4); },
      set: function (val) { this.writeUInt8(val, 4); },
    },
    'dataType' : {
      enumerable: true,
      get: function () { return this.readUInt8(5); },
      set: function (val) { this.writeUInt8(val, 5); },
    },
    'vBucket' : {
      enumerable: true,
      get: function () { return this.readUInt16BE(6); },
      set: function (val) { this.writeUInt16(val, 6); },
    },
    'dataLength' : {
      enumerable: true,
      get: function () { return this.readUInt32BE(8); },
      set: function (val) { this.writeUInt32BE(val, 8); },
    },
    'opaque' : {
      enumerable: true,
      get: function () { return this.readUInt32BE(12); },
      set: function (val) { this.writeUInt32BE(val, 12); },
    },
    'cas' : {
      enumerable: true,
      get: function () { return Int64this.slice(16, 23); },
      set: function (val) { val.copy(this, 0, 16, 23) },
    }
  });
  return buffer
}
module.exports.createHeader = createHeader

function createUInt16BE(val) {
  var buffer = new Buffer(2);
  buffer.writeUInt16BE(val, 0);
  return buffer;
}
module.exports.createUInt16BE = createUInt16BE


function createUInt32BE(val) {
  var buffer = new Buffer(4);
  buffer.writeUInt32BE(val, 0);
  return buffer;
}
module.exports.createUInt32BE = createUInt32BE


