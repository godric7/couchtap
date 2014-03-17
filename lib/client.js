
var util       = require('util');
var events     = require('events');
var sasl       = require('saslmechanisms');
var sasl_plain = require('sasl-plain')
var Int64      = require('node-int64')

var factory    = require('./factory.js');
var Connection = require('./connection.js');

// Init SASL Factory
var sasl_factory = new sasl.Factory();
sasl_factory.use(sasl_plain);
var sasl_plain = sasl_factory.create(['PLAIN']);


var Client = function(opts) {
  this.opts = opts;
  this._connected = false 
  this._conn = new Connection();
  this._conn.on('connect', this._onConnect.bind(this));
  this._conn.on('error', this._onError.bind(this));
  this._conn.on('close', this._onClose.bind(this));
  this._conn.on('data', this._onData.bind(this));
  this._conn.on('end', this._onEnd.bind(this));
  if (this.opts.connect === true)
    process.nextTick(this.connect.bind(this))
}

util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function() {
  this._conn.connect({
    host: this.opts.host,
    port: this.opts.port || 11210
  });
}

Client.prototype.end = function() {
  this._conn.end();
}

Client.prototype.close = function() {
  this._conn.close();
}

Client.prototype._onConnect = function() {
  this._requestSASLMechs()
}

Client.prototype._onError = function(err) {
  this.emit('error', err)
}

Client.prototype._onClose = function(err) {
  this._connected = false;
}

Client.prototype._onData = function(header, extras, key, body) {
  this.emit('data', header, extras, key, body);
  switch (header.opcode) {
    case 0x20:
      this._handleSASLMechs(header, extras, key, body); 
      break;
    case 0x21:
      this._handleSASLAuth(header, extras, key, body); 
      break;
    case 0x41:
      this._handleMutation(header, extras, key, body); 
      break;
    case 0x42:
      this._handleDelete(header, extras, key, body); 
      break;
    case 0x43:
      this._handleFlush(header, extras, key, body); 
      break;
    case 0x43:
      this._handleFlush(header, extras, key, body); 
      break;
    case 0x44:
      this.handleOpaque(header, extras, key, body);
      break;
  }
}

Client.prototype._onEnd = function(err) {
  this._connected = false;
}
/* SASL Mechanisms */
Client.prototype._requestSASLMechs = function() {
  var header = factory.createHeader();
  header.magic  = 0x80;
  header.opcode = 0x20;
  this._conn.send(header);
}

Client.prototype._handleSASLMechs = function(header, extras, key, body) {
  var mechs = extras.toString('ascii').split(' ');
  this._requestSASLAuth(mechs)
}

/* SASL Authentification */
Client.prototype._requestSASLAuth = function(mechs) {
  var key  = new Buffer('PLAIN');
  var body = new Buffer(sasl_plain.response({
    username: this.opts.bucket, 
    password: this.opts.password
  }));
  var header = factory.createHeader();
  header.magic = 0x80;
  header.opcode = 0x21;
  header.keyLength = key.length
  header.dataLength = key.length + body.length

  this._conn.send(header, key, body)
}

Client.prototype._handleSASLAuth = function(header, extras, key, body) {
  var status = body.toString('utf8')
  // console.log('[cli][authed]', status);
  if (status == 'Authenticated') {
    this._connected = true;
    if (this.opts.mode)
      this.setMode(this.opts.mode)
    this.emit('connect')
  }
  else {
    this._onError(new Error(status))
    this._conn.close()
  }
}

/* Set TAP Mode */
Client.prototype.setMode = function(mode) {
  if (!this._connected) { return; }
  this.mode = mode;

  var extras = factory.createUInt32BE(
    (mode.backfill  ? 0x01 : 0) |
    (mode.dump      ? 0x02 : 0) |
    (mode.vbuckets  ? 0x04 : 0) |
    (mode.takover   ? 0x08 : 0) |
    (mode.ack       ? 0x10 : 0) |
    (mode.keysOnly  ? 0x20 : 0) |
    (mode.registred ? 0x80 : 0)
  );

  var key = new Buffer(this.opts.name || 0);

  var chunks = [];
  if (mode.backfill) {
    chunks.push((new Int64(mode.backfill)).buffer);
  }
  if (mode.vbuckets) {
    chunks.push(factory.createUInt16BE(mode.vbuckets.length));
    mode.vbuckets.forEach(function (vbucket) {
      chunks.push(factory.createUInt16BE(vbucket));
    });
  }
  var body = Buffer.concat(chunks);

  var header = factory.createHeader();
  header.magic        = 0x80;
  header.opcode       = 0x40;
  header.extrasLength = extras.length;
  header.keyLength    = key.length;
  header.dataLength   = (extras.length + key.length + body.length);

  this._conn.send(header, extras, key, body);
}

/* Events */
Client.prototype._handleMutation = function(header, extras, key, body) {
  var misc     = {
    header: header.toObject(),
    extras: {
      engine    : extras.readUInt16BE(0),
      flags     : extras.readUInt16BE(2),
      ttl       : extras.readUInt8(4),
      reserved  : extras.slice(5,8),
      itemFlags : extras.readUInt32BE(8),
      itemExpiry: extras.readUInt32BE(12)
    }
  }
  var metaLength = misc.extras.engine
  var metas      = key.slice(0, metaLength);
  var key        = Buffer.concat([
    key.slice(metaLength, key.length),
    body.slice(0, key.length - metaLength)
  ]).toString('utf8');
  var body       = body.slice(metaLength).toString('utf8');
  this.emit('mutation', metas, key, body, misc);
}

Client.prototype._handleDelete = function(header, extras, key, body) {
  var misc     = {
    header: header.toObject(),
    extras: {
      engine    : extras.readUInt16BE(0),
      flags     : extras.readUInt16BE(2),
      ttl       : extras.readUInt8(4),
      reserved  : extras.slice(5,8),
    }
  }
  var metaLength = misc.extras.engine
  var metas      = key.slice(0, metaLength);
  var key        = Buffer.concat([
    key.slice(metaLength, key.length),
    body.slice(0, key.length - metaLength)
  ]).toString('utf8');

  this.emit('delete', metas, key, misc)
}

Client.prototype._handleFlush = function(header, extras, key, body) {
  var misc     = {
    header: header.toObject(),
    extras: {
      engine    : extras.readUInt16BE(0),
      flags     : extras.readUInt16BE(2),
      ttl       : extras.readUInt8(4),
      reserved  : extras.slice(5,8),
    }
  }
  this.emit('flush', misc)
}

Client.prototype._handleOpaque = function(header, extras, key, body) {
  var misc     = {
    header: header.toObject(),
    extras: {
      engine    : extras.readUInt16BE(0),
      flags     : extras.readUInt16BE(2),
      ttl       : extras.readUInt8(4),
      reserved  : extras.slice(5,8),
    }
  }
  var _flags = body.readUInt32BE()
  var flags =   {
    enableAcks        : (_flags && 1),
    startBackfill     : (_flags && 2),
    enableCheckpoints : (_flags && 4),
    openChekpoint     : (_flags && 8),
    startOnlineUpdate : (_flags && 16),
    stopOnlineUpdate  : (_flags && 32),
    closeStream       : (_flags && 64),
    closeBackfill     : (_flags && 128)
  }
  this.emit('opaque', flags, misc)
}



module.exports = Client;