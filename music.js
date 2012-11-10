var mpg = require('mpg123'),
	scp = require('scp'),
	fs = require('fs'),
	track = require('./track').track,
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('library.db'),
	config = require('./config');

Date.prototype.iso = function(){
 function pad(n){return n<10 ? '0'+n : n};
 return this.getFullYear()+'-'
      + pad(this.getMonth()+1)+'-'
      + pad(this.getDate())+'T'
      + pad(this.getHours())+':'
      + pad(this.getMinutes())+':'
      + pad(this.getSeconds())+'Z'
}

// milliseconds 2 minutes
var ms2mn = function(ms) {
  var s = Math.floor(ms / 1000);
  return Math.floor(s / 60);
}

// general purpose time converter
var convertMS = function(ms) {
  var d, h, m, s;
  s = Math.floor(ms / 1000);
  m = Math.floor(s / 60);
  s = s % 60;
  h = Math.floor(m / 60);
  m = m % 60;
  d = Math.floor(h / 24);
  h = h % 24;
  return { d: d, h: h, m: m, s: s };
};

// random date between two dates
var randomDate = function(start, end) {
	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

var playlist = function(obj) {
	for (var i in obj) this[i] = obj[i];
	this.position = 0;
	this.successfullyTransferred = 0;
	this.allTransfers = 0;
	this.started = false;
}
playlist.prototype.play = function(position) {
	this.log("Playing: "+this.list[position].readable());
	var self = this,
		player = new mpg()
			.play(this.list[position].local)
			.on('error',function(error) { 
				self.log('error');
				self.log(error); 
			})
			.on('end', function () {
				player.close();
				self.log('track ended')
				self.position++;
				if (self.list[self.position]) {
					self.log('next track')
					self.play(self.position);
				} else {
					self.log('playlist finished!')
					if (self.finish) self.finish();
				}
			});
}
playlist.prototype.onFinish = function(callback) {
	this.finish = callback;
	return this;
}
playlist.prototype.transferCheck = function( success ) {
	if (success === true) this.successfullyTransferred++;
	this.allTransfers++;
	// console.log('total'+this.list.length);
	var midway = (this.list.length > 2) ? Math.round(this.list.length/2) : 1;
	this.log("transferred so far "+this.allTransfers);
	this.log('midway'+midway);
	if (this.allTransfers >= midway && this.started === false) {
		this.started = true;
		this.log('Transfers finished!');
		if (this.transferCallback) this.transferCallback();
	}
}
playlist.prototype.transfer = function() {
	var self = this;
	this.list.forEach(function(t) {
		t.transfer(function(success) { self.transferCheck(success); });
	});
}
playlist.prototype.onTransfer = function(callback) {
	if (this.started === true) {
		callback();
	} else {
		this.transferCallback = callback;
	}
}
playlist.prototype.log = function(msg) {
	console.log(this.beginning.iso() + ": "+ msg );
}
playlist.prototype.start = function() {
	var self = this;
	this.onTransfer(function() {
		self.play(self.position);
	});
	return this;
}
playlist.prototype.cleanup = function() {
	this.list.forEach(function(t) {
		console.log(t.local);
		fs.unlinkSync(t.local);
	});
}
playlist.prototype.current = function() {
	return this.list[this.position];
}
playlist.prototype.reverse = function() {
	return this.list.slice(0).splice(0,this.position+1).reverse();
}

var music = {
	started:false,
	playlist:function() {
		return this.lists[0];
	},
	next : function() {
		this.lists[0].start().log('starting');
	},
	add : function(data) {
		var self = this,
			p = new playlist(data);
		p.transfer();
		p.onFinish(function() {
			p.cleanup();
			p.log(self.lists.length);
			self.lists.splice(0,1);
			p.log(self.lists.length);
			self.next(); // this restarts play
			self.added--;
			self.load();  // this restarts transfer
		});
		p.number = self.lists.push(p) - 1;
		if (self.started !== true) {
			self.next(); // first start happens here
			self.started = true;
		}
		return p;
	},
	load:function() {
		var self = this;
		while (this.added < 2) {
			this.added++;
			this.import(function(data) {
				var p = self.add(data);
			});
		}
	},
	added:0,
	lists:[],
	import:function(callback) {
		var tracks = [],
			startDate;
		db.get("SELECT * FROM library ORDER BY RANDOM() LIMIT 1;",function(err,row) {
			startDate = new Date(row.dateAdded);
			//console.log("select * from library where julianday(dateAdded) < julianday('"+startDate.iso()+"') order by julianday(dateAdded) desc limit 100;");
			db.each("select * from library where julianday(dateAdded) < julianday('"+startDate.iso()+"') order by julianday(dateAdded) desc limit 100;",
			function(err,row) {
				if (!err) tracks.push(row);
			},
			function() {
				//console.log(tracks.length+" total tracks")
				var added = [],
					setDuration = 0,
					maxInMinutes = config.length,
					i = tracks.length-1;
				//console.log('Importing Library ... ' + startDate);

				while ( ms2mn(setDuration) < maxInMinutes) {
					var t = new track(tracks[ i ]);
					if ( t.shouldAdd( startDate ) === true) {
						//console.log( t.readable() );
						added.push(t);
						setDuration += parseInt(t.duration);
					}
					i--;
				}
				var beginning = added[added.length-1].dateAdded;
				//console.log('Beginning: '+added[0].date()+' ending: '+added[added.length-1].date() );
				//console.log("Total: "+ms2mn(setDuration) + "m");
				callback({
					list:added,
					ending:startDate,
					beginning:beginning
				});
			});
		});
	}
}

music.load();
exports.playlist = function() {
	return music.playlist();
};


// walk(process.env.HOME+"/Music/iTunes/iTunes\ Music", function(err, results) {
//   if (err) throw err;
//   console.log(results);
// });