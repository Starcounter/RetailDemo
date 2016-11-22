using System;
using System.Threading;
using System.Collections.Generic;
using Starcounter;
using Starcounter.Internal;

namespace ScRetailDemo {

    class ScRetailDemo {

        static void Main() {

            // Handler that adds statistics from client.
            Handle.GET("/ScRetailDemo/addstats?numFail={?}&numOk={?}&numReads={?}&numWrites={?}",
                (Request req, String numFail, String numOk, String numReads, String numWrites) => {

                Db.Transact(() => {

                    RetailClientStatsDb entry = new RetailClientStatsDb() {
                        Received = DateTime.Now.ToString("yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'"),
                        ClientIp = req.ClientIpAddress.ToString(),
                        NumFail = numFail,
                        NumOk = numOk,
                        NumReads = numReads,
                        NumWrites = numWrites
                    };

                });

                return 204;
            });

            // Getting all clients statistics.
            Handle.GET("/ScRetailDemo/proxy", () =>
            {
                string result = "(null)";
                // client is running on a third machine using 'wrk -t 10 -c 1000 http://192.168.60.186:8080/proxy'
                // DNX minimal example using Kestrel frontend gets about 13000 req/sec
                result = Http.GET<string>("http://192.168.60.169:80/"); // about 4000 req/sec
                // result = new System.Net.WebClient().DownloadString("http://192.168.60.169:80/"); // about 11000 req/sec
                return result;
            });

            // Getting all clients statistics.
            Handle.GET("/ScRetailDemo/stats", () => {

                var json = new RetailClientStatsJson();
                json.AllClientStats = Db.SQL("SELECT s FROM RetailClientStatsDb s");

                return new Response() { BodyBytes = json.ToJsonUtf8() };
            });

            // Initializes the database state.
            Handle.GET("/ScRetailDemo/init", () => {

                // Removing existing objects from database.
                Db.Transact(() => {
                    Db.SlowSQL("DELETE FROM Account");
                    Db.SlowSQL("DELETE FROM RetailCustomer");
                    Db.SlowSQL("DELETE FROM RetailClientStatsDb");
                });

                // Creating all needed indexes.
                if (Db.SQL("SELECT i FROM Starcounter.Metadata.\"Index\" i WHERE i.Name = ?", "AccountCustomerIndex").First == null)
                    Db.SQL("CREATE INDEX AccountCustomerIndex ON Account (RetailCustomer asc)");

                if (Db.SQL("SELECT i FROM Starcounter.Metadata.\"Index\" i WHERE i.Name = ?", "AccountIdIndex").First == null)
                    Db.SQL("CREATE UNIQUE INDEX AccountIdIndex ON Account (AccountId asc)");

                if (Db.SQL("SELECT i FROM Starcounter.Metadata.\"Index\" i WHERE i.Name = ?", "CustomerIdIndex").First == null)
                    Db.SQL("CREATE UNIQUE INDEX CustomerIdIndex ON RetailCustomer (CustomerId asc)");

                if (Db.SQL("SELECT i FROM Starcounter.Metadata.\"Index\" i WHERE i.Name = ?", "FullNameIndex").First == null)
                    Db.SQL("CREATE INDEX FullNameIndex ON RetailCustomer (FullName asc)");

                return 200;
            });

            Handle.GET("/ScRetailDemo/serverAggregates", () => {
                ThreadHelper.SetYieldBlock();
                try {
                    return "AccountBalanceTotal=" + Db.SlowSQL<Int64>("SELECT SUM (a.Balance) FROM Account a").First;
                }
                finally {
                    ThreadHelper.ReleaseYieldBlock();
                }
            });

            Handle.GET("/ScRetailDemo/customers/{?}", (int customerId) => {
                var json = new CustomerJson();
                json.Data = Db.SQL("SELECT p FROM RetailCustomer p WHERE CustomerId = ?", customerId).First;
                return json.ToJsonUtf8();
            });

            Handle.GET("/ScRetailDemo/dashboard/{?}", (int customerId) => {
                var json = new CustomerAndAccountsJson();
                json.Data = Db.SQL("SELECT p FROM RetailCustomer p WHERE CustomerId = ?", customerId).First;
                return json.ToJsonUtf8();
            });

            Handle.GET("/ScRetailDemo/customers?f={?}", (string fullName) => {
                var json = new CustomerJson();
                json.Data = Db.SQL("SELECT p FROM RetailCustomer p WHERE FullName = ?", fullName).First;
                return json.ToJsonUtf8();
            });

            Handle.POST("/ScRetailDemo/customers/{?}", (int customerId, CustomerAndAccountsJson json) => {
                Db.Transact(() => {
                    var customer = new RetailCustomer { CustomerId = (int)json.CustomerId, FullName = json.FullName };
                    foreach (var a in json.Accounts) {
                        new Account {
                            AccountId = (int) a.AccountId,
                            Balance = (int) a.Balance,
                            RetailCustomer = customer
                        };
                    }
                });
                return 201;
            });

            Handle.GET("/ScRetailDemo/transfer?f={?}&t={?}&x={?}", (int fromId, int toId, int amount) => {

                ushort statusCode = 0;
                String statusDescription = null;

                if (fromId == toId) {
                    statusDescription = "Giving money to yourself is redundant.";
                    statusCode = 200;
                } else if (amount <= 0) {
                    statusDescription = "Amount to transfer must be positive.";
                    statusCode = 400;
                } else {
                    Db.Transact(() => {

                        Account source = Db.SQL<Account>("SELECT a FROM Account a WHERE AccountId = ?", fromId).First;
                        Account target = Db.SQL<Account>("SELECT a FROM Account a WHERE AccountId = ?", toId).First;

                        if (source == null) {
                            statusDescription = "Source account does not exist.";
                            statusCode = 400;
                        } else if (target == null) {
                            statusDescription = "Target account does not exist.";
                            statusCode = 400;
                        } else if (source.Balance < amount) {
                            statusDescription = "Insufficient funds on source account.";
                            statusCode = 400;
                        } else {
                            source.Balance -= amount;
                            target.Balance += amount;

                            statusDescription = "Transfer OK.";
                            statusCode = 200;
                        }
                    });
                }

                return new Response() { 
                    StatusDescription = statusDescription,
                    StatusCode = statusCode
                };
            });
        }
    }

    [Database]
    public class RetailClientStatsDb { // Statistics entry from the client.
        public String Received; // Datetime when statistics received.
        public String ClientIp; // Client IP address.
        public String NumFail; // Number of failed responses since last report.
        public String NumOk; // Number of successful responses since last report.
        public String NumReads; // Number of reads since last report.
        public String NumWrites; // Number of writes since last report.
    }

    [Database]
    public class RetailCustomer { // Represents a customer with an account.
        public int CustomerId; // Public identifier.
        public string FullName; // RetailCustomer's name.
        public IEnumerable<Account> Accounts { get { return Db.SQL<Account>("SELECT a FROM Account a WHERE a.RetailCustomer=?", this); } }
    }

    [Database]
    public class Account { // Represents an account for a specific customer.
        public int AccountId; // Public identifier.
        public int Balance; // Money balance in account.
        public RetailCustomer RetailCustomer; // To which customer this account belongs.
    }
}
