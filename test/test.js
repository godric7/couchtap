var net = require('net');
var tap = require('..');

var tap_opts = {
  name:     'test1',
  host:     'vm-ubuntu',
  bucket:   'test',
  password: 'password',
  modes   : {
    backfill: -1,
  }
}

var con = new tap.Client(tap_opts);

con.on('connect', function() {
  con.setMode(tap_opts.modes);
});

con.on('mutation', function (meta, key, body) {
  console.log('-=-=-=-=-=-=-=-=[Data]-=-=-=-=-=-=-=-=')
  console.log('[test][data][meta]', meta);
  console.log('[test][data][key]', key);
  console.log('[test][data][body]', body);
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=')
})
con.connect();
