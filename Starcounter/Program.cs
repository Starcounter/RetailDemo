using System;
using System.Collections.Generic;
using Starcounter;
using Starcounter.Internal;

namespace ScRetailDemo {

    class ScRetailDemo {

        static void Main() {

            // Handler that adds statistics from client.
            Handle.GET("/addstats?numFail={?}&numOk={?}", (Request req, String numFail, String numOk) => {

                Db.Transaction(() => {

                    ClientStatsEntry cs = new ClientStatsEntry() {
                        Received = DateTime.Now.ToString("yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'"),
                        ClientIp = req.ClientIpAddress.ToString(),
                        NumFail = numFail,
                        NumOk = numOk
                    };

                });

                return 204;
            });

            // Getting all clients statistics.
            Handle.GET("/stats", () => {

                var json = new ClientStatsJson();
                json.AllClientStats = Db.SQL("SELECT s FROM ClientStatsEntry s");

                return new Response() { BodyBytes = json.ToJsonUtf8() };
            });

            // Initializes the database state.
            Handle.GET("/init", () => {

                // Creating all needed indexes.
                CreateIndexes();

                // https://github.com/Starcounter/Starcounter/issues/1602
                Json.DirtyCheckEnabled = false;

                Db.Transaction(() => {
                    Db.SlowSQL("DELETE FROM Account");
                    Db.SlowSQL("DELETE FROM Customer");
                    Db.SlowSQL("DELETE FROM ClientStatsEntry");
                });

                return 200;
            });

            Handle.GET("/serverAggregates", () => {
                return "AccountBalanceTotal=" + Db.SlowSQL<Int64>("SELECT SUM (a.Balance) FROM Account a").First;
            });

            Handle.GET("/customers/{?}", (int customerId) => {
                var json = new CustomerJson();
                json.Data = Db.SQL("SELECT p FROM Customer p WHERE CustomerId = ?", customerId).First;
                return json.ToJsonUtf8();
            });

            Handle.GET("/dashboard/{?}", (int customerId) => {
                var json = new CustomerAndAccountsJson();
                json.Data = Db.SQL("SELECT p FROM Customer p WHERE CustomerId = ?", customerId).First;
                return json.ToJsonUtf8();
            });

            Handle.GET("/customers?f={?}", (string fullName) => {
                var json = new CustomerJson();
                json.Data = Db.SQL("SELECT p FROM Customer p WHERE FullName = ?", fullName).First;
                return json.ToJsonUtf8();
            });

            Handle.POST("/customers/{?}", (int customerId, CustomerAndAccountsJson json) => {
                Db.Transaction(() => {
                    var customer = new Customer { CustomerId = (int) json.CustomerId, FullName = json.FullName };
                    foreach (var a in json.Accounts) {
                        new Account {
                            AccountId = (int) a.AccountId,
                            Balance = (int) a.Balance,
                            Customer = customer
                        };
                    }
                });
                return 201;
            });

            Handle.GET("/transfer?f={?}&t={?}&x={?}", (int fromId, int toId, int amount) => {
                Db.Transaction(() => {
                    Account source = Db.SQL<Account>("SELECT a FROM Account a WHERE AccountId = ?", fromId).First;
                    Account target = Db.SQL<Account>("SELECT a FROM Account a WHERE AccountId = ?", toId).First;
                    source.Balance -= amount;
                    target.Balance += amount;
                    //if (source.Balance < 0 || target.Balance < 0 ) {
                    //    throw new Exception("You cannot move money that is not in the account");
                    //}
                });
                return 200;
            });
        }

        private static void CreateIndexes() {

            if (Db.SQL("SELECT i FROM MaterializedIndex i WHERE Name = ?", "AccountIdIndex").First == null) {

                Db.SQL("CREATE UNIQUE INDEX AccountIdIndex ON Account (AccountId asc)");
            }

            if (Db.SQL("SELECT i FROM MaterializedIndex i WHERE Name = ? AND \"Table\".Name = ?", "Auto", "Account").First != null) {
                Db.SQL("DROP INDEX Auto ON Account");
            }

            if (Db.SQL("SELECT i FROM MaterializedIndex i WHERE Name = ?", "CustomerIdIndex").First == null)
                Db.SQL("CREATE UNIQUE INDEX CustomerIdIndex ON Customer (CustomerId asc)");

            if (Db.SQL("SELECT i FROM MaterializedIndex i WHERE Name = ?", "FullNameIndex").First == null)
                Db.SQL("CREATE INDEX FullNameIndex ON Customer (FullName asc)");

            if (Db.SQL("SELECT i FROM MaterializedIndex i WHERE Name = ?", "CustomerIndex").First == null)
                Db.SQL("CREATE INDEX CustomerIndex ON Account (Customer, AccountId asc)");

            if (Db.SQL("SELECT i FROM MaterializedIndex i WHERE Name = ? AND \"Table\".Name = ?", "Auto", "Customer").First != null) {
                Db.SQL("DROP INDEX Auto ON Customer");
            }
        }
    }

    [Database]
    public class ClientStatsEntry {
        public String Received;
        public String ClientIp;
        public String NumFail;
        public String NumOk;
    }

    [Database]
    public class Customer { // Represents a customer with an account.
        public int CustomerId; // Public identifier.
        public string FullName; // Customer's name.
        public IEnumerable<Account> Accounts { get { return Db.SQL<Account>("SELECT a FROM Account a WHERE a.Customer=?", this); } }
    }

    [Database]
    public class Account { // Represents an account for a specific customer.
        public int AccountId; // Public identifier.
        public int Balance; // Money balance in account.
        public Customer Customer; // To which customer this account belongs.
    }
}
