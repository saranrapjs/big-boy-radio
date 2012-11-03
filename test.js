var mpg = require('mpg123');
	var self = this,
		player = new mpg()
			.play("files/17 2K Strut.mp3")
			.on('end', function () {
				
				player.play('files/15 Behold The Land.mp3');
			});