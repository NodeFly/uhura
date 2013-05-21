var Uhura = require('../');

function after (t, fn) {
	return function () {
		t-- && t == 0 && fn();
	}
}

describe('session', function () {
	this.timeout(5000);

	it('should keep session', function (next) {
		var server = Uhura.createServer(function (s) {
			setTimeout(function () {
				s.disconnect();
			}, 100);
		});
		server.listen(4567);

		var c = Uhura.createClient(4567);
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
			s.set('foo', 'bar');
		});
		server.listen(4567);

		var c = Uhura.createClient(4567);
	  c.on('_set', function () {
	  	process.nextTick(function () {
	  		c.get('foo').should.equal('bar');
	  		c.disconnect();
	  	});
	  });

	  c.on('disconnect', function () {
	  	server.close(next);
	  });
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
		server.listen(4567);

		var c = Uhura.createClient(4567);
		c.on('connect', function () {
			c.set('foo', 'bar');
		});
	  c.on('disconnect', function () {
	  	server.close(next);
	  });
	});
});