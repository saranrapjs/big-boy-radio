var sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('library.db');
var tracks = [];
var get = db.each("SELECT * FROM library",function(err,row) {
	if (err) {

	} else {
		tracks.push(row);
	}
},function() {
	console.log(tracks.length);	
});
