var Uhura = require('../');

function after (t, fn) {
	return function () {
		t-- && t == 0 && fn();
	}
}

describe('reconnection', function () {
	this.timeout(5000);

	it('should reconnect when autoReconnect is enabled', function (next) {
		var server = Uhura.createServer(function (s) {
		  setTimeout(function () {
			  s.disconnect();
			}, 100)
		})
		server.listen(3333);

		var c = Uhura.createClient(3333);
		c.autoReconnect();

	  c.on('connect', after(2, function () {
			server.close(next);
			c.disconnect();
	  }));
	});

	it('should continue receiving events after reconnection', function (next) {
		var done = after(2, function () {
			server.close(next);
			c.disconnect();
		});

		var server = Uhura.createServer(function (s) {
			s.on('ping', function () {
				s.disconnect();
				done();
			});
		});
		server.listen(4444);

		var c = Uhura.createClient(4444);
	  c.autoReconnect();
	  c.on('connect', function () {
			c.send('ping');
		});
	});

	it('should not lose messages while disconnected', function (next) {
		var sent = [], received = [];

		var done = after(3, function () {
  		for (var i = 0; i < sent.length; i++) {
	  		sent[i].should.equal(received[i]);
	  	}
	  	server.close(next);
  		c.disconnect();
		})

		var server = Uhura.createServer(function (s) {
			// Disconnect after 250ms
			setTimeout(function () {
				s.disconnect();
				done();
			}, 250);

			// Push received pings to list
			s.on('ping', function (v) {
				received.push(v);
			});
		})
		server.listen(5555);

		var c = Uhura.createClient(5555);

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