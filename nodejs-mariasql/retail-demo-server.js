// https://www.npmjs.org/package/mariasql
// https://github.com/strongloop/express


var db_config = {
    host: '127.0.0.1',
    user: 'retail',
    password: 'xyzzy',
    db: 'retail',
    multiStatements: true,
}

var inspect = require('util').inspect;
var bodyParser = require('body-parser');
var Client = require('mariasql');
var express = require('express')

var c = new Client();

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function run_query(res, next_query, callback) {
    console.log(next_query);
    c.query(next_query)
    .on('error', function(err) {
        callback(err);
    })
    .on('result', function(dbres) {
        query_result = [];
        dbres
        .on('row', function(row) {
            query_result.push(row);
        })
        .on('end', function(info) {
            callback(query_result);
        })
    })
}

function process_query_list(res, next_query) {
    if (next_query) {
        run_query(res, next_query, function(query_result) {
            res.query_results.push(query_result);
            return process_query_list(res, res.query_list.shift());
        })
    } else {
        res.json(res.query_results);
    }
}

app.get('/init', function (req, res) {
    res.query_list =
            [
                "CREATE TABLE IF NOT EXISTS Customer (CustomerId INT PRIMARY KEY, FullName VARCHAR(32) NOT NULL, INDEX FullNameIndex (FullName))",
                "CREATE TABLE IF NOT EXISTS Account (AccountId INT PRIMARY KEY, AccountType INT DEFAULT 0, Balance INT DEFAULT 0, CustomerId INT NOT NULL, FOREIGN KEY (CustomerId) REFERENCES Customer(CustomerId) ON DELETE CASCADE)",
                "DELETE FROM Account",
                "DELETE FROM Customer",
                "DROP PROCEDURE IF EXISTS AccountBalanceTransfer",
                "CREATE PROCEDURE AccountBalanceTransfer (fromId INT, toId INT, amount INT) NOT DETERMINISTIC MODIFIES SQL DATA SQL SECURITY DEFINER" +
                "  this_proc:BEGIN" +
                "    START TRANSACTION;" +
                "    UPDATE Account SET Balance = Balance - amount WHERE AccountId = fromId;" +
                "    IF ROW_COUNT() = 1 THEN" +
                "      BEGIN" +
                "        UPDATE Account SET Balance = Balance + amount WHERE AccountId = toId;" +
                "        IF ROW_COUNT() = 1 THEN" +
                "          BEGIN" +
                "            COMMIT;" +
                "            LEAVE this_proc;" +
                "          END;" +
                "        END IF;" +
                "      END;" +
                "    END IF;" +
                "    ROLLBACK;" +
                "  END;"
            ];
    res.query_results = [];
    process_query_list(res, res.query_list.shift());
});

/*
    Handle.GET("/serverAggregates", () => {
        return "AccountBalanceTotal=" + Db.SlowSQL<Int64>("SELECT SUM (a.Balance) FROM Account a").First;
    });
*/
app.get("/serverAggregates", function (req, res) {
    c.query("SELECT SUM(Balance) AS Total FROM Account")
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres.on('row', function(row) {
            res.send('AccountBalanceTotal=' + row.Total);
        })
    })
});


/*
Handle.PUT("/customers/{?}", (int customerId, CustomerAndAccounts json) => {
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
*/
app.post("/customers/:id", function (req, res) {
    c.query("INSERT INTO Customer VALUES (?, ?)", [req.params.id, req.body.FullName])
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres.on('error', function(err) {
            res.status(409).send(err.message);
        })
        .on('end', function(info) {
            res.status(201);
            messages = '';
            for (n in req.body.Accounts) {
                c.query("INSERT INTO Account VALUES (?, ?, ?, ?)",[req.body.Accounts[n].AccountId, req.body.Accounts[n].AccountType, req.body.Accounts[n].Balance, req.params.id])
                .on('error', function(err) {
                    messages += 'Account: ' + err.message + "\r\n";
                    res.status(500);
                })
                .on('result', function(dbres) {
                    dbres.on('error', function(err) {
                        messages += 'Account: ' + err.message + "\r\n";
                        res.status(409);
                    })
                })
            }
            res.send(messages);
        })
    })
});

/*
Handle.GET("/customers/{?}", (int customerId) => {
    var json = new CustomerJson();
    json.Data = Db.SQL("SELECT p FROM Customer p WHERE CustomerId = ?", customerId).First;
    return new Response() { BodyBytes = json.ToJsonUtf8() };
});
*/
app.get("/customers/:id", function (req, res) {
    c.query("SELECT * FROM Customer WHERE CustomerId = ?", [req.params.id])
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres.on('row', function(row) {
            res.json(row)
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.sendStatus(204)
        })
    })
});

/*
Handle.GET("/dashboard/{?}", (int customerId) => {
    var json = new CustomerAndAccounts();
    json.Data = Db.SQL("SELECT p FROM Customer p WHERE CustomerId = ?", customerId).First;
    return new Response() { BodyBytes = json.ToJsonUtf8() };
});
*/
app.get("/dashboard/:id", function (req, res) {
    c.query("SELECT * FROM Customer WHERE CustomerId = ?", [req.params.id])
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(customer_res) {
        customer_res.on('row', function(customer_row) {
            customer_row.Accounts = [];
            c.query("SELECT * FROM Account WHERE CustomerId = ?", [req.params.id])
            .on('result', function(account_res) {
                account_res.on('row', function(account_row) {
                    customer_row.Accounts.push(account_row);
                })
                .on('end', function(info) {
                    res.json(customer_row);
                })
            })
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.sendStatus(204)
        })
    })
});

/*
Handle.GET("/customers?f={?}", (string fullName) => {
    var json = new CustomerJson();
    json.Data = Db.SQL("SELECT p FROM Customer p WHERE FullName = ?", fullName).First;
    return new Response() { BodyBytes = json.ToJsonUtf8() };
});
*/
app.get("/customers", function (req, res) {
    c.query("SELECT * FROM Customer WHERE FullName = ?", [req.query.f])
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres
        .on('row', function(row) {
            res.json(row)
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.sendStatus(404)
        })
    })
});


/*
Handle.POST("/transfer?f={?}&t={?}&x={?}", (int fromId, int toId, int amount) => {
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
*/
app.get("/transfer", function (req, res) {
    c.query("CALL AccountBalanceTransfer(?, ?, ?)", [req.query.f, req.query.t, req.query.x], true)
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres
        .on('error', function(err) {
            res.status(500).send(err.message);
        })
    })
    .on('end', function(info) {
        res.sendStatus(204);
    })
});

app.get("/check", function (req, res) {
    var body = '<html><body>';
    var rowcount = 0;
    c.query('SHOW DATABASES')
    .on('result', function(dbres) {
        body += '<table>';
        dbres.on('row', function(row) {
            if (!rowcount) {
                body += '<tr>';
                for (col in row) {
                    body += '<td><tt><u>' + col + '</u></tt></td>';
                }
                body += '</tr>';
            }
            rowcount++;
            body += '<tr>';
            for (col in row) {
                body += '<td><tt>' + row[col] + '</tt></td>';
            }
            body += '</tr>';
        })
        .on('error', function(err) {
            res.send('<strong><tt>' + err + '</tt></strong>');
        })
        .on('end', function(info) {
            body += '</table>';
        });
    })
    .on('end', function() {
        body += '</body></html>';
        res.send(body);
    });
});

app.get('/quit', function (req, res) {
    res.send('Quitting.');
    c.end();
});

app.get('/', function (req, res) {
    res.send(' \
<html> \
<body> \
<table> \
<tr> <td><a href="/init"><tt>GET /init</tt></a></td>        <td>Initialize server tables and indices</td> </tr> \
<tr> <td><a href="/check"><tt>GET /check</tt></a></td>      <td>Check that the sum of all accounts are zero</td> </tr> \
<tr> <td><a href="/quit"><tt>GET /quit</tt></a></td>        <td>Quit the nodejs server application</td> </tr> \
</table> \
</body> \
</html> \
')
})

if (!module.parent) {
    console.log('Using database config "' + db_config.user + '@' + db_config.host + '"');
    c.connect(db_config);
    c.on('connect', function() {
        console.log('Starting application on port 3000');
        app.listen(3000);
    })
    .on('error', function(err) {
        console.log(err.message);
        process.exit(err.errno);
    })
    .on('close', function(hadError) {
        if (hadError) {
            console.log(hadError.message);
            process.exit(hadError.errno);
        } else {
            console.log('Exiting.');
            process.exit(0);
        }
    });
}
