RetailDemo
==========

Retail demo projects

`Starcounter` contains the server side implementation using Starcounter.
`nodejs-mysql` contains a server side implementation using nodejs with the MySQL driver. This is the recommended code to use when testing with MySQL or MariaDB/Galera, and probably other MySQL-compatible databases as well. Testing for this was done on Amazon EC2 using a MariaDB 10.0/Galera cluser (with 5, 3 and 1 node).
`nodejs-mariasql` contains a server side implementation using nodejs and MariaDB/Galera. Due to an issue with the mariasql driver for nodejs, this is not usable for write tests with high load, as the driver fails when an error occurs while fetching query results (and there will be database deadlocks during high load).

