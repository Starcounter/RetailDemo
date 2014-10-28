// https://www.npmjs.org/package/mariasql

var server = require('node-router').getServer();
var inspect = require('util').inspect;
var Client = require('mariasql');

// Configure our HTTP server to respond with Hello World the root request
server.get("/", function (request, response) {
  response.simpleText(200, "Hello World!");
});

// Listen on port 8080 on localhost
server.listen(8000, "localhost");




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

c.query('SHOW DATABASES')
 .on('result', function(res) {
   res.on('row', function(row) {
     console.log('Result row: ' + inspect(row));
   })
   .on('error', function(err) {
     console.log('Result error: ' + inspect(err));
   })
   .on('end', function(info) {
     console.log('Result finished successfully');
   });
 })
 .on('end', function() {
   console.log('Done with all results');
 });

c.end();

