var Client = require('./lib/client')
	, Server = require('./lib/server')


// Create a client
exports.Client = Client
exports.createClient = function (port, host) {
	var client = new Client
	client.connect(port, host)
	return client
}


// Create a server
exports.Server = Server
exports.createServer = function (cb) {
	var server = new Server
	return server.start(cb)
}