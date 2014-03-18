var util   = require('util');
var net    = require('net');
var events = require('events');

var factory = require('./factory.js');


var Connection = function(opts) {
  this._sock = new net.Socket();
  this._sock.on('connect', this._onConnect.bind(this));
  this._sock.on('data',    this._onData.bind(this));
  this._sock.on('error',   this._onError.bind(this));
  this._sock.on('close',   this._onClose.bind(this));
  this._sock.on('end',     this._onEnd.bind(this));
  this._buffer = new Buffer(0);
}

util.inherits(Connection, events.EventEmitter);

Connection.prototype.connect = function() {
  this._sock.connect.apply(this._sock, arguments);
}

Connection.prototype.close = function() {
  this._sock.close.apply(this._sock, arguments);
}

Connection.prototype.send = function() {
  var args = Array.prototype.slice.call(arguments)
  this.write(Buffer.concat(args))
}

Connection.prototype.write = function(data) {
  // console.log('-=-=-=-=-=-=-=-=[Send]-=-=-=-=-=-=-=-=')
  // console.log('[conn][send]', data);
  // console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=')
  this._sock.write(data);
}

Connection.prototype._onConnect = function () {
  // console.log('[conn][connect]');
  this.emit('connect');
}

Connection.prototype._onData = function(data) {
  var self = this;
  this._buffer = Buffer.concat([this._buffer, data])

  // while (true) {
  function doLoop() {
    // Get header
    var offset = 0
    var length = 24;
    if (self._buffer.length < (offset + length)) return;
    var header = factory.createHeader(self._buffer.slice(offset, length))
    // console.log('[conn][data][header]', header);

    // Get Extras
    offset += length
    length = header.extrasLength;
    if (self._buffer.length < (offset + length)) return;
    var extras = self._buffer.slice(offset, offset + length);
    // console.log('[conn][data][extras]', extras);


    // Get Key
    offset += length
    length = header.keyLength;
    if (self._buffer.length < (offset + length)) return;
    var key = self._buffer.slice(offset, offset + length);
    // console.log('[conn][data][key]', key);

    // Get Body
    offset += length
    length = header.dataLength - (header.keyLength + header.extrasLength);
    if (self._buffer.length < (offset + length)) return;
    var body = self._buffer.slice(offset, offset + length);
    // console.log('[conn][data][body]', body);

    console.log('-=-=-=-=-=-=-=-=[Recv]-=-=-=-=-=-=-=-=')
    console.log('[conn][data][header]', header);
    console.log('[conn][data][extras]', extras);
    console.log('[conn][data][key]', key);
    console.log('[conn][data][body]', body);
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=')

    // Clean up and Emit data
    offset += length
    self._buffer = self._buffer.slice(offset)
    self.emit('data', header, extras, key, body);
    process.nextTick(doLoop)
  }
  doLoop()

}

Connection.prototype._onError= function(err) {
  // console.log('[conn][error]', err.code);
  this.emit('error', err);
}
Connection.prototype._onClose = function() {
  this.emit('close'); 
}

Connection.prototype._onEnd = function() {
  // console.log('[conn][end]')
  this.emit('end'); 
}

module.exports = Connection;