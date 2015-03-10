'use strict';

var port = process.env.PORT || 3000;
var server = require('../server');
var options = {
  notify: function (data, done) {
    done();
  }
};

server(options).listen(port);
