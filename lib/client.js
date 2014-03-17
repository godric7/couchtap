
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
  this._connected = 0 
  this._conn = new Connection();
  this._conn.on('connect', this._onConnect.bind(this));
  this._conn.on('error', this._onError.bind(this));
  this._conn.on('close', this._onClose.bind(this));
  this._conn.on('data', this._onData.bind(this));
  this._conn.on('end', this._onEnd.bind(this));
}

util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function() {
  this._conn.connect({
    host: this.opts.host,
    port: this.opts.port || 11210
  });
}

Client.prototype._onConnect = function() {
  this._requestSASLMechs()
}

Client.prototype._onError = function(err) {
  console.log('onError', err)
  this.emit('error', err)
}

Client.prototype._onClose = function(err) {
  this._connected = false;
}

Client.prototype._onData = function(header, extras, key, body) {
  // console.log('data!', header.opcode)
  if (header.opcode == 0x20)
    this._handleSASLMechs(header, extras, key, body)
  else if (header.opcode == 0x21)
    this._handleSASLAuth(header, extras, key, body)
  else if (header.opcode == 0x41)
    this._handleMutation(header, extras, key, body)
  else if (header.opcode == 0x42)
    this._handleDelete(header, extras, key, body)
  else if (header.opcode == 0x43)
    this._handleFlush(header, extras, key, body)
  this.emit('raw', header, extras, key, body);
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
  console.log('[cli][authed]', status);
  if (status == 'Authenticated') {
    this.emit('connect')
    this._connected = true;
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
  console.log('header', header);

  this._conn.send(header, extras, key, body);
}

/* Events */
Client.prototype._handleMutation = function(header, extras, key, body) {
  var metaLength = extras.readUInt16BE(0);
  var metas      = key.slice(0, metaLength);
  var key        = Buffer.concat([
    key.slice(metaLength, key.length),
    body.slice(0, metaLength)
  ]).toString('utf8');
  var body       = body.slice(metaLength).toString('utf8');

  this.emit('mutation', metas, key, body);
}

Client.prototype._handleDelete = function(header, extras, key, body) {
  var metaLength = extras.readUInt16BE(0);
  var metas      = key.slice(0, metaLength);
  var key        = key.slice(metaLength, key.length);

  this.emit('delete', metas, key)
}

Client.prototype._handleFlush = function(header, extras, key, body) {

  this.emit('flush', metas, key, body)
}



module.exports = Client;