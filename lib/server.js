var Connection = require('./connection')
	, Session = require('./session')
	, net = require('net');

/**
 * Server constructor
 * 
 * @param {object} options [options to pass to the session constructor]
 */

function Server (options) {
	this.sessionStore = Session(options);
	this._sessions = [];
}
module.exports = Server;

/**
 * Start the server
 * 
 * @param  {object}     [options] [See built-in net.createServer() and
 *                                 tls.createServer() functions.  The server
 *                                 is created with options.createServer() or
 *                                 net.createServer() if options.createServer
 *                                 is omitted.]
 * @param  {function}   [cb] [Callback to handle each connection]
 * @return {object}     [Server instance created]
 */

Server.prototype.start = function (options, cb) {
	var server = this;
	if (arguments.length === 1) {
		cb = options, options = {};
	}
	var createServer = options.createServer || net.createServer;
	return createServer(options, function (socket) {
		var con = new Connection(socket, server);
		con.once('connect', function (reconnect) {
			cb(con, reconnect);
		});
	});
};
