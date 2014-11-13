RetailDemo
==========

### Retail demo projects.

This implements a very simple REST-ful API server and client. While simple, it still requires full database transaction support to function properly.

`Starcounter` contains the server side implementation using Starcounter.

`nodejs-mysql` contains a server side implementation using nodejs with the MySQL driver. This is the recommended code to use when testing with MySQL or MariaDB/Galera, and probably other MySQL-compatible databases as well. Testing for this was done on Amazon EC2 using a MariaDB 10.0/Galera cluster (with 5, 3 and 1 nodes).

`nodejs-mariasql` contains a server side implementation using nodejs and MariaDB/Galera. Due to an issue with the mariasql driver for nodejs, this is not usable for write tests with high load, as the driver fails when an error occurs while fetching query results (and there will be database deadlocks during high load).

`client` contains the implementation of Retail demo client which is used for both Starcounter and MariaDb. Client can operate in several modes which is described below.

### Details on the MariaDB/Galera setup

We used http://www.severalnines.com/ to create a small cluster of five machines on Amazon EC2. Each of the nodes was provisioned with an 8-core vCPU and 16GB of RAM and an EBS root volume and high network throughput. The dataset was quite small (500k Customer rows and 1500k Account rows), so the fairly low RAM was not an issue.

On each node, we run 8 instances of the nodejs-mysql (or mariasql for read-only loads). Running with fewer instances of nodejs yields less throughput. The nodejs processes connect using Unix Domain sockets for maximum performance.

We ran the cluster with 5, 3 and 1 Galera node to test how the cluster scales different load types with size. As expected, read loads scale almost perfectly and write loads scale negatively with cluster size due to Galera node replication. The highest MariaDB/Galera read performance was achieved using 5 Galera nodes using the asynchronous MariaDB driver. The highest write performance for MariaDB/Galera (both 100% write and 5% write) was achieved using only one Galera node.

During the tests, we ensured that the server throughput was as high as possible. During the 100% read and 95% read tests the server CPU was fully loaded. During the write tests it was mostly idle as all time was spent waiting for the database write and replication to complete.

For more details on how to set up the RetailDemo servers with MariaDB/Galera, see https://github.com/Starcounter/RetailDemo/tree/master/nodejs-mysql

### Details of the client implementations

There are two modes the client can operate: using direct connections and using aggregated connections. 

In direct connections mode, the client establishes HTTP socket connections to specified server endpoints (define by parameters -ServerIps and -ServerPorts). Each worker (communicates with one endpoint) creates a synchronous socket connection to endpoint,
sends requests and receives responses. In our testing case we used a maximum number of 40 endpoints (5 nodes in cluster, each node had 8 NodeJs servers running on different ports). In our tests we used a maximum of 6 Retail clients with direct connections.
However, the peak performance for MariaDb can be reached using only 3 clients (database performance is the limitation in this case).

In aggregation mode numerous client connections are multiplexed into several "thick" connections that transform aggregated traffic. Aggregation clients accumulate and send traffic over few "thick" connections,
which are demultiplexed and processed on the server (Starcounter in our case). The reason for aggregation mode is simple:
Windows performance of TCP/IP stack is limited to a maximum of 200 thousands (varies between machines) send/recv operations per second (RPS). So, in order, to saturate the server with higher load volumes, the
traffic has to be aggregated into "thicker" sockets that resemble "virtual" connections. As an example, to saturate the server with 1 Million RPS, around 6 frontend aggregation machines should be used. RetailClient in aggregation mode
simulates these aggregation machines, so that Starcounter server can be fully saturated. Note that, aggregation protocol is open and can be implemented as a module to any HTTP server such as Nginx, Apache, NodeJs or any other.

Using direct connections, total performance would always be limited by the possibilities of TCP/IP stack, which, as we already mentioned, reaches a maximum of around 200K RPS on a decent Windows machine.
That is the reason why during tests with Starcounter the aggregation is required (expected needed saturation for Starcounter is around 1 Million HTTP requests per second, which includes database access, JSON serialization, etc).
In contrast, for MariaDb direct connections are more then sufficient, since only a few retail clients are needed to fully saturarate the MariaDb cluster.
