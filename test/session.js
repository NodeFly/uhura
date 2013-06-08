var Uhura = require('../');

function after (t, fn) {
	return function () {
		t-- && t === 0 && fn();
	};
}

var port = 12345;

describe('session', function () {
	this.timeout(5000);

	it('should keep session', function (next) {
		var server = Uhura.createServer(function (s) {
			setTimeout(function () {
				s.disconnect();
			}, 100);
		});
		server.listen(port);
		
		var c = Uhura.createClient(port);
		c.autoReconnect();

		var sessionID;
		c.once('connect', function () {
			sessionID = c.get('sessionID');
		});

		c.on('connect', after(2, function () {
			if (c.get('sessionID') !== sessionID) {
				next(new Error('sessionID does not match'));
			}
			c.disconnect();
			server.close(next);
		}));
	});

	it('should send changes to client', function (next) {
		var server = Uhura.createServer(function (s) {
			server.close(function () {
				c.get('foo').should.equal('bar');
				next();
			});

			c.once('_set', function () {
				s.disconnect();
			});
			s.set('foo', 'bar');
		});
		server.listen(port);

		var c = Uhura.createClient(port);
	});

	it('should send changes to server', function (next) {
		var server = Uhura.createServer(function (s) {
			s.on('_set', function () {
				process.nextTick(function () {
					s.get('foo').should.equal('bar');
					s.disconnect();
				});
			});
		});
		server.listen(port);

		var c = Uhura.createClient(port);
		c.on('connect', function () {
			c.set('foo', 'bar');
		});
		c.on('disconnect', function () {
			server.close(next);
		});
	});
});