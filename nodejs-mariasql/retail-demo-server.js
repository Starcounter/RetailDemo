// https://www.npmjs.org/package/mariasql

var inspect = require('util').inspect;
var server = require('node-router').getServer();
var Client = require('mariasql');

var c = new Client();
c.connect({
  host: '127.0.0.1',
  user: 'retail',
  password: 'xyzzy'
});

c.on('connect', function() {
   console.log('Client connected');
 })
 .on('error', function(err) {
   console.log('Client error: ' + err);
 })
 .on('close', function(hadError) {
   console.log('Client closed');
 });


server.get("/", function (request, response) {
  response.simpleText(200, "Hello World!");
});

server.get("/showdb", function (request, response) {
  var text = "<html><table>\n";
  c.query('SHOW DATABASES')
    .on('result', function(res) {
      res.on('row', function(row) {
	text += '<tr>' + inspect(row) + '</tr>';
      })
      .on('error', function(err) {
	text += '<hr><strong>' + inspect(err) + '</strong><hr>';
      })
      .on('end', function(info) {
	text += '</table>';
      });
    })
    .on('end', function() {
	text += '</html>\n';
    });
  });
  response.simpleHtml(200, text);
});

server.listen(8000, "localhost");

c.end();

