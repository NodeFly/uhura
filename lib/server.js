var Connection = require('./connection')
	, Session = require('./session')
	, fs = require('fs')
	, tls = require('tls');

var serverOptions = {
	cert: fs.readFileSync(__dirname + '/../scripts/server.cert'),
	key: fs.readFileSync(__dirname + '/../scripts/server.key'),
	passphrase: 'server',
	rejectUnauthorized: true,
	requestCert: true
};

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
 * @param  {function}   [cb] [Callback to handle each connection]
 * @return {tls.Server}      [Server instance created]
 */

Server.prototype.start = function (cb) {
	var server = this;
	return tls.createServer(serverOptions, function (socket) {
		var con = new Connection(socket, server);
		con.once('connect', function (reconnect) {
			cb(con, reconnect);
		});
	});
};
