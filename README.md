# CouchTAP

## Install

```bash
npm install couchtap
```

## Introduction

This is a CouchBase TAP client implementation for node.js. This is a WIP, full javascript implementation.

The TAP protocol allows you to be notified when events occurs in your couchbase buckets. 

Here is a basic exemple:

```js
var tap  = require('couchtap')
var wire = new tap.Client({
  name:     'test1',
  host:     'vm-ubuntu',
  bucket:   'test',
  password: 'password',
});
wire.on('connect', function() {
  wire.setMode({
    backfill : -1,  // Require backfill for future events
    onlyKeys : true // Get only keys (the server might ignore this) 
  })
})
wire.connect();
```

Or if you want the connection and mode setup to happen automagically:

```js
var tap  = require('couchtap')
var wire = new tap.Client({
  name:     'test1',
  connect:  true,
  host:     'vm-ubuntu',
  bucket:   'test',
  password: 'password',
  mode:     {
    dump : true, // Dump all documents
  }
});
```

Then listen to events :

```js
wire.on('mutation', function(meta, key, body, misc) {
  console.log('The document ', key, ' just changed');
})

wire.on('delete', function(meta, key, misc) {
  console.log('The document ', key, ' was deleted');
})

wire.on('flush', function(misc) {
  console.log('The bucket was flushed');
})

wire.on('opaque', function(flags, misc) {
  console.log('Opaque frame with flags:', flags);
})
```

## Documentation

There is none at the moment, just refer to the couchbase wiki page on [TAP Protocol](http://www.couchbase.com/wiki/display/couchbase/TAP+Protocol)


## TODO

* Handle vBucket, Checkpoint responses
* vBucket related features testing
* Write tests
* Write documentation
* A lot of other stuffs
