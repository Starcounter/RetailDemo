## Setting up the RetailDemo nodejs servers with  MySQL/Galera

You will need to have an account on Amazon EC2 and know how to use it, as well as basic Linux syadmin knowledge at a minimum. If you haven't set up a Galera cluster before, you can read the tutorial at http://www.severalnines.com/resources/deploy-galera-replication-cluster-amazon-vpc. Remember to provision the nodes with at least 8 vCPU's in order to have compute power to run nodejs processes on them.

Once the Galera cluster is up and running, copy `retail-demo-mysql.js` and `run-retail-mysql.sh` to each of the Galera nodes. Finally, run `run-retail-mysql.sh` on all of the nodes to spin up the nodejs processes. They will listen to HTTP requests on ports 3000 - 3007. Verify that they're running using `curl -v http://localhost:3000/`.

You can now run the RetailDemo client scripts, but make sure that the IP addresses in the client control script are correct.
