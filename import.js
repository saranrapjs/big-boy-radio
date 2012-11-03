console.time('Total import time:');

var sqlite3 = require('sqlite3').verbose(),
	plist = require('plist'),
	track = require('./track').track,
	config = require('./config'),
	scp = require('scp'),
	db = new sqlite3.Database('library.db');

console.log('transferring library file...');
scp.get({
	file:"\"~/Music/iTunes/iTunes\\ Music\\ Library.xml\"",
	user: config.user,
	host: config.host,
	port: config.port,
	path: "\"./iTunes\ Music\ Library.xml\""
},function(err){
	if (err) {
		console.log("Couldn't transfer iTunes library xml!");
	} else {
		console.log('library transfer complete, starting db process');
	var dict = plist.parseFileSync('iTunes\ Music\ Library.xml'),
		tracks = dict['Tracks'],
		keys = Object.keys( tracks );

	db.serialize(function() {
		db.run("DROP TABLE library");
		db.run("CREATE TABLE library (name TEXT, type TEXT, artist TEXT, duration TEXT, dateAdded TEXT, path TEXT, local TEXT)");

		var stmt = db.prepare("INSERT INTO library VALUES (?,?,?,?,?,?,?)");

		keys.forEach(function(v,i) {
			var t = new track();
			t.import(tracks[ keys[i] ]);
			stmt.run( t.export() );
		});
		stmt.finalize();

		// var count = 0;
		// var get = db.each("SELECT * FROM library",function(err,row) {
		// 	count++;
		// });
	});

	console.timeEnd('Total import time:');


	}
});