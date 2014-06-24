var SDI = require('..');

sdi = new SDI({host: '192.168.72.130'});

sdi.on('connect', function(){
	sdi.route(1,1, function(err){
		console.log('route', err);
		console.log(sdi.getRouteTo(1));
	});

	sdi.route(3,2, function(err){
		console.log('route', err);
	});
});