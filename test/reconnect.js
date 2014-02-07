var Uhura = require('../');
var assert = require('assert');
var net = require('net');

function after (t, fn) {
	return function () {
		t-- && t == 0 && fn();
	};
}

describe('reconnection', function () {
	this.timeout(5000);

	// Kill server and client after each test
	var c, server;
	afterEach(function (next) {
		c.disconnect();
		server.close(next);
	});

	it('should reconnect when autoReconnect is enabled', function (next) {
		server = Uhura.createServer(function (s) {
			setTimeout(function () {
				s.socket.destroy();
			}, 100);
		});

		var options = null;
		server.listen(0, '127.0.0.1', function () {
			options = {
				host: this.address().address,
				port: this.address().port,
			};
			c = Uhura.createClient({
				createConnection: createConnection,
			});
			c.unref();
			c.autoReconnect();
			c.on('connect', after(2, done));
		});

		var unrefCalls = 0;
		function createConnection (_, cb) {
			var socket = net.connect(options);
			socket.unref = (function (unref) {
				return function () {
					unrefCalls += 1;
					return unref.apply(this, arguments);
				};
			})(socket.unref);
			cb(null, socket);
		}

		function done () {
			assert.equal(unrefCalls, 2);
			next();
		}
	});

	it('should continue receiving events after reconnection', function (next) {
		var done = after(2, next);

		server = Uhura.createServer(function (s) {
			s.on('ping', function () {
				done();
				s.socket.destroy();
			});
		});

		server.listen(0, '127.0.0.1', function () {
			c = Uhura.createClient({
				host: this.address().address,
				port: this.address().port,
			});
			c.autoReconnect();
			c.on('connect', function () {
				c.send('ping');
			});
		});
	});

	it('should not lose messages while disconnected', function (next) {
		var sent = [], received = [];

		var done = after(3, function () {
			for (var i = 0; i < sent.length; i++) {
				sent[i].should.equal(received[i]);
			}
			next();
		});

		server = Uhura.createServer(function (s) {
			// Disconnect after 250ms
			setTimeout(function () {
				s.socket.destroy();
				done();
			}, 250);

			// Push received pings to list
			s.on('ping', function (v) {
				received.push(v);
			});
		});

		server.listen(0, '127.0.0.1', function () {
			c = Uhura.createClient({
				host: this.address().address,
				port: this.address().port,
			});

			// Send messages repeatedly
			var timer = setInterval(function () {
				var num = Math.floor(Math.random() * 1000);
				c.send('ping', num);
				sent.push(num);
			}, 100);

			c.on('connect', after(3, function () {
				clearInterval(timer);
			}));

			c.autoReconnect();
		});
	});
});
