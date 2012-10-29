var scp = require('scp');
scp.get({
  file: "\"/Users/jeffsisson/Music/iTunes/iTunes Music/Erykah Badu/Baduizm/05 Sometimes (mix#9).mp3\"".replace(/(["\s'$`\\\()])/g,'\\$1'), // remote file to grab
  user: 'jeffsisson',   // username to authenticate as on remote system
  host: 'localhost',   // remote host to transfer from, set up in your ~/.ssh/config
  port: '22',         // remote port, optional, defaults to '22'
  path: 'files/'           // local path to save to (this would result in a ~/file.txt on the local machine)
});