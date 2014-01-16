var Client = require('./client')
	, Server = require('./server')
	, Session = require('./session');

/**
 * This is lowercase to mirror how connect.session works
 * 
 *   var RedisStore = require('connect-redis')(Uhura);
 *   var server = Uhura.createServer({
 *     store: new RedisStore(options)
 *   }, function (socket) {
 *     // Session-aware socket/emitter
 *   });
 */

exports.session = Session;

/**
 * Create uhura client
 * 
 * @param  {object}        [Connection settings.  See built-in `net.connect()`
 *                          and `tls.connect()`]
 * @return {uhura.Client}  [Client emitter]
 */

exports.Client = Client;
exports.createClient = function () {
	var client = new Client;
	// Allows uhura.createClient(options)
	// and uhura.createClient(port, [host])
	client.connect.apply(client, arguments);
	return client;
};

/**
 * Create uhura server
 *
 * @param {object}      [options] [Optional session store options]
 * @param {function}    [cb]      [Function to handle each connection]
 * @return {uhura.Server}         [TCP server to use, not yet listening]
 */

exports.Server = Server;
exports.createServer = function (options, cb) {
	if (typeof options === 'function') {
		cb = options;
		options = {};
	}
	var server = new Server(options);
	return server.start(options, cb);
};
