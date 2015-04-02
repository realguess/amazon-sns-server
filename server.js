// Amazon SNS HTTP Endpoint
// ========================
//
// A simple Amazon SNS HTTP endpoint server that subscribe to a topic and show
// request and response logs related to Amazon SNS activities.
//
// > (c) 2015 Chao Huang <chao@realguess.net>

var http  = require('http');
var https = require('https'); // HTTPS is needed for Amazon SNS subscription.
var logs  = []; // Keep a log of all requests/responses from Amazon SNS.

// Simple request.
function request(url, callback) {
  var req = https.request(url, function (res) {
    var body = '';
    res.on('data', function (chunk) { body += chunk; });
    res.on('end' , function (chunk) {
      if (chunk) { body += chunk; }
      callback(null, res, body);
    });
  });
  req.on('error', function (err) { callback(err, null, null); });
  req.end();
}

// Simple response with logs of previous Amazon SNS requests/responses.
function respond(res) {
  // Remove the first item, keep the log small.
  if (logs.length > 20) { logs.shift(); }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(logs));
}

// Log request coming from Amazon SNS.
function logRequest(err, req, body, rawBody) {
  logs.push({
    method : req.method,
    url    : req.url,
    headers: req.headers,
    rawBody: rawBody,
    length : rawBody.length,
    body   : body,
    error  : err,
  });
}

// Log response after requesting resource to Amazon SNS.
function logResponse(err, res, body) {
  logs.push({
    status : res.statusCode,
    headers: res.headers,
    body   : body,
    error  : err,
  });
}

// Usage: `server(options).listen(port)`
module.exports = function (options) {
  var noop = function (data, done) { done(); };

  if (Object(options) !== options) {
    options = {};
  }

  ['subscribe', 'notify', 'unsubscribe', 'unknown'].forEach(function (action) {
    if (typeof options[action] !== 'function') {
      options[action] = noop;
    }
  });

  return http.createServer(function (req, res) {
    var messageType = req.headers['x-amz-sns-message-type'];
    var rawBody, body;
    var done = function () {
      respond(res);
    };
  
    // Ignore all requests that are not related to Amazon SNS.
    if (req.method !== 'POST' || !messageType) {
      return respond(res);
    }
  
    rawBody = '';
    req.on('data', function (chunk) { rawBody += chunk; });
    req.on('end' , function (chunk) {
      if (chunk) { rawBody += chunk; }
  
      try {
        body = JSON.parse(rawBody);
        logRequest(null, req, body, rawBody);
      } catch (err) {
        logRequest(err , req, null, rawBody);
      }
  
      switch (messageType) {
        case 'SubscriptionConfirmation':
          // Visiting subscription URL and response to subscription confirmation
          // request can happen at the same time.
          request(body.SubscribeURL, logResponse);
          options.subscribe(rawBody, done);
          break;

        case 'Notification':
          options.notify(rawBody, done);
          break;

        case 'UnsubscriptionConfirmation':
          options.unsubscribe(rawBody, done);
          break; 

        default:
          // Unrecognized Amazon SNS messages
          options.unknown(rawbody, done);
      }
    });
  });
};
