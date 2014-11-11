// https://www.npmjs.org/package/mariasql
// https://github.com/strongloop/express

// npm install express body-parser mariasql --save

var listen_port = '3000';
var db_config = {
    unixSocket: '/var/run/mysqld/mysqld.sock',
    user: 'retail',
    password: 'xyzzy',
    db: 'retail',
}

var inspect = require('util').inspect;
var bodyParser = require('body-parser');
var Client = require('mariasql');
var express = require('express')

var c = new Client();

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var os = require('os');
var ifaces = os.networkInterfaces();
var server_ip = '127.0.0.1';
for (var dev in ifaces) {
    ifaces[dev].forEach(function(details) {
        if (details.family==='IPv4' && dev !== 'lo') {
            server_ip = details.address;
        }
    });
}

function run_query(res, next_query, callback) {
    c.query(next_query)
    .on('error', function(err) {
        console.log(next_query);
        console.log(err);
        res.status(500);
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
        if (res.statusCode < 300) {
            res.sendStatus(res.statusCode);
        } else {
            console.log(res.statusCode + ": " + req.query_results);
            res.json(res.query_results);
        }
    }
}


app.get('/init', function (req, res) {
    res.query_list =
            [
                "DROP TABLE IF EXISTS Account",
                "DROP TABLE IF EXISTS Customer",
                "DROP TABLE IF EXISTS ClientStats",
                "CREATE TABLE IF NOT EXISTS ClientStats (SeqNo INT PRIMARY KEY AUTO_INCREMENT, Received TIMESTAMP, ServerIpPort VARCHAR(40), numFail INT, numOk INT, numReads INT, numWrites INT, INDEX ReceivedIndex (Received))",
                "CREATE TABLE IF NOT EXISTS Customer (CustomerId INT PRIMARY KEY, FullName VARCHAR(32) NOT NULL, INDEX FullNameIndex (FullName))",
                "CREATE TABLE IF NOT EXISTS Account (AccountId INT PRIMARY KEY, AccountType INT DEFAULT 0, Balance INT DEFAULT 0, CustomerId INT NOT NULL, FOREIGN KEY (CustomerId) REFERENCES Customer(CustomerId) ON DELETE CASCADE)",

                "DROP PROCEDURE IF EXISTS AccountBalanceTransfer",
                "CREATE PROCEDURE AccountBalanceTransfer (fromId INT, toId INT, amount INT) NOT DETERMINISTIC MODIFIES SQL DATA SQL SECURITY DEFINER" +
                "  BEGIN" +
                "    DECLARE EXIT HANDLER FOR SQLEXCEPTION "+
                "    BEGIN"+
                "      SELECT 0 AS Success;" +
                "    END;"+
                "    START TRANSACTION;" +
                "    UPDATE Account SET Balance = Balance + (" +
                "      SELECT CASE " +
                "        WHEN AccountId = toId" +
                "           THEN amount" +
                "           ELSE - amount" +
                "        END" +
                "      )" +
                "    WHERE" +
                "      (AccountId = fromId AND Balance - amount >= 0) " +
                "      OR (AccountId = toId AND Balance + amount >= 0);" +
                "    IF ROW_COUNT() = 2 THEN" +
                "      COMMIT;" +
                "      SELECT 1 AS Success;" +
                "    ELSE" +
                "      ROLLBACK;" +
                "      SELECT 0 AS Success;" +
                "    END IF;" +
                "  END"
            ];
    res.query_results = [];
    res.status(204);
    process_query_list(res, res.query_list.shift());
});

//  /addstats?numFail=X&numOk=Y&numReads=A&numWrites=B
app.get("/addstats", function (req, res) {
    c.query("INSERT INTO ClientStats VALUES (0, NOW(), '" +
            c.escape(server_ip + ':' + listen_port) + "', " +
            c.escape(req.query.numFail) + ", " +
            c.escape(req.query.numOk) + ", " +
            c.escape(req.query.numReads) + ", " +
            c.escape(req.query.numWrites) +
            ")")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres
        .on('end', function(info) {
            res.sendStatus(200);
        })
    })
});

app.get("/stats", function (req, res) {
    res.ClientInfos = [];
    c.query("SELECT * FROM ClientStats")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres
        .on('row', function(row) {
            res.ClientInfos.push(row);
        })
        .on('end', function(info) {
            res.json(res.ClientInfos);
        })
    })
});

app.get("/serverAggregates", function (req, res) {
    c.query("SELECT SUM(Balance) AS AccountBalanceTotal FROM Account")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres.on('row', function(row) {
            res.send('AccountBalanceTotal=' + row.AccountBalanceTotal);
        })
    })
});


app.post("/customers/:id", function (req, res) {
    res.query_list = ["INSERT INTO Customer VALUES (" + req.params.id + ", '" + c.escape(req.body.FullName) + "')"];
    for (n in req.body.Accounts) {
        if (typeof req.body.Accounts[n].AccountType == 'undefined')
            req.body.Accounts[n].AccountType = 0;
        if (typeof req.body.Accounts[n].Balance == 'undefined')
            req.body.Accounts[n].Balance = 1000;
        res.query_list.push(
                    "INSERT INTO Account VALUES (" +
                    req.body.Accounts[n].AccountId + ", " +
                    req.body.Accounts[n].AccountType + ", " +
                    req.body.Accounts[n].Balance + ", " +
                    req.params.id +
                    ")");
    }
    res.query_results = [];
    process_query_list(res, res.query_list.shift());
});

var pq_customers_id = c.prepare('SELECT * FROM Customer WHERE CustomerId = ?');
app.get("/customers/:id", function (req, res) {
    c.query(pq_customers_id([parseInt(req.params.id)]))
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres.on('row', function(row) {
            res.json(row)
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.sendStatus(200)
        })
    })
});

var pq_customers_fullname = c.prepare('SELECT * FROM Customer WHERE FullName = ?');
app.get("/customers", function (req, res) {
    c.query(pq_customers_fullname([req.query.f]))
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(customer_res) {
        res.query_result = [];
        customer_res
        .on('row', function(customer_row) {
            res.query_result.push(customer_row);
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.sendStatus(404);
            else
                res.json(res.query_result);
        })
    })
});

var pq_dashboard = c.prepare('SELECT * FROM Customer WHERE CustomerId = ?');
app.get("/dashboard/:id", function (req, res) {
    c.query(pq_dashboard([req.params.id]))
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(customer_res) {
        customer_res
        .on('row', function(customer_row) {
            res.query_result = customer_row;
            customer_row.Accounts = [];
            c.query("SELECT * FROM Account WHERE CustomerId = ?", [customer_row.CustomerId])
            .on('result', function(account_res) {
                account_res
                .on('row', function(account_row) {
                    customer_row.Accounts.push(account_row);
                })
                .on('end', function(info) {
                    res.json(res.query_result);
                })
            })
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.sendStatus(404);
        })
    })
});

function why_transfer_fail(req, res) {
    c.query(pq_balance([req.query.f]))
    .on('error', function(err) {
        console.log('pq_balance (will retry): ' + err.message);
        setTimeout(do_the_transfer, 1000, req, res);
    })
    .on('result', function(dbres) {
        dbres
        .on('row', function(row) {
            if (row.Balance < req.query.x) {
                res.status(400).send('Insufficient funds on source account');
            } else {
                // check that the destination account exists
                c.query('SELECT * FROM Account WHERE AccountId=?', [req.query.t])
                .on('result', function(dbres) {
                    dbres
                    .on('end', function(info) {
                        if (info.numRows !== 1) {
                            res.status(400).send('Destination account missing: ' + req.query.t);
                        } else {
                            console.log('Retrying transfer ' + req.query);
                            setTimeout(do_the_transfer, 1000, req, res);
                        }
                    })
                })
            }
        })
        .on('error', function(err) {
            console.log('pq_balance:result (will retry): ' + err.message);
            setTimeout(do_the_transfer, 1000, req, res);
        })
        .on('end', function(info) {
            if (!info.numRows)
                res.status(400).send('Source account missing: ' + req.query.f);
        })
    })
}

var pq_transfer = c.prepare('CALL AccountBalanceTransfer(?, ?, ?)');
function do_the_transfer(req, res) {
    c.query(pq_transfer([req.query.f, req.query.t, req.query.x]))
    .on('error', function(err) {
        console.log('pq_transfer (will retry): ' + err.message);
        setTimeout(do_the_transfer, 1000, req, res);
    })
    .on('result', function(dbres) {
        dbres
        .on('row', function(row) {
            if (row.Success === '1') {
                res.status(200).send('Transfer OK');
            } else {
                why_transfer_fail(req, res);
            }
        })
        .on('error', function(err) {
            console.log('pq_transfer:result (will retry): ' + err.message);
            setTimeout(do_the_transfer, 1000, req, res);
        })
    })
}

var pq_balance = c.prepare('SELECT Balance FROM Account WHERE AccountId=?');
app.get("/transfer", function (req, res) {
    req.query.f = parseInt(req.query.f)
    req.query.t = parseInt(req.query.t)
    req.query.x = parseInt(req.query.x)
    if (req.query.x <= 0) {
        if (!res.headersSent)
            res.status(400).send('Amount to transfer must be positive.');
        return;
    }
    if (req.query.f === req.query.t) {
        if (!res.headersSent)
            res.status(200).send('Giving money to yourself is redundant.');
        return;
    }

    do_the_transfer(req, res);
});

app.get('/quit', function (req, res) {
    res.send('Quitting.');
    c.end();
});

app.get('/', function (req, res) {
    if (c.connected)
        res.send("Database connected\r\n");
    else
        res.send("Database OFFLINE\r\n");
})


function connect_to_db() {
    if (c.connected)
        return;
    c.connect(db_config);
    c.on('error', function(err) {
        console.log('Database connection failed, reconnecting: ' + err.message);
        setTimeout(connect_to_db, 1000);
    })
    c.on('close', function(err) {
        console.log('Database connection closed, reconnecting: ' + err);
        setTimeout(connect_to_db, 1000);
    })
    .on('connect', function() {
        console.log('Connected to database');
    })
}

if (!module.parent) {
    var args = process.argv.slice(2);
    for (n in args) {
        listen_port = args[n];
    }
    if (db_config.unixSocket)
        console.log('Using database config "' + db_config.user + ' @ unix:' + db_config.unixSocket + '"');
    else
        console.log('Using database config "' + db_config.user + ' @ tcp:' + db_config.host + '"');
    connect_to_db();
    console.log('Starting application on port ' + listen_port);
    app.listen(listen_port);
}
