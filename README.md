RetailDemo
==========

### Retail demo projects.

This implements a very simple REST-ful API server and client. While simple, it still requires full database transaction support to function properly.

`Starcounter` contains the server side implementation using Starcounter.

`nodejs-mysql` contains a server side implementation using nodejs with the MySQL driver. This is the recommended code to use when testing with MySQL or MariaDB/Galera, and probably other MySQL-compatible databases as well. Testing for this was done on Amazon EC2 using a MariaDB 10.0/Galera cluster (with 5, 3 and 1 nodes).

`nodejs-mariasql` contains a server side implementation using nodejs and MariaDB/Galera. Due to an issue with the mariasql driver for nodejs, this is not usable for write tests with high load, as the driver fails when an error occurs while fetching query results (and there will be database deadlocks during high load).

### Details on the MariaDB/Galera setup

We used http://www.severalnines.com/ to create a small cluster of five machines on Amazon EC2. Each of the nodes was provisioned with an 8-core vCPU and 16GB of RAM and an EBS root volume and high network throughput. The dataset was quite small (500k Customer rows and 1500k Account rows), so the fairly low RAM was not an issue.

On each node, we run 8 instances of the nodejs-mysql (or mariasql for read-only loads). Running with fewer instances of nodejs yields less throughput. The nodejs processes connect using Unix Domain sockets for maximum performance.

We ran the cluster with 5, 3 and 1 Galera node to test how the cluster scales different load types with size. As expected, read loads scale almost perfectly and write loads scale negatively with cluster size due to Galera node replication. The highest MariaDB/Galera read performance was achieved using 5 Galera nodes using the asynchronous MariaDB driver. The highest write performance for MariaDB/Galera (both 100% write and 5% write) was achieved using only one Galera node.

During the tests, we ensured that the server throughput was as high as possible. During the 100% read and 95% read tests the server CPU was fully loaded. During the write tests it was mostly idle as all time was spent waiting for the database write and replication to complete.
