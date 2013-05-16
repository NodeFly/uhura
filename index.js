var Client = require('./lib/client')
	, Server = require('./lib/server')
	, Session = require('./lib/session');


// This is lowercase to mirror how connect.session works
// 
//   var RedisStore = require('connect-redis')(Uhura);
//   var server = Uhura.createServer({
//     store: new RedisStore(options)
//   }, function (socket) {
//     // Session-aware socket/emitter
//   });
exports.session = Session;


// Create a client
exports.Client = Client;
exports.createClient = function (port, host) {
	var client = new Client;
	client.connect(port, host);
	return client;
};


// Create a server
exports.Server = Server;
exports.createServer = function (options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	}
	var server = new Server(options);
	return server.start(cb);
};