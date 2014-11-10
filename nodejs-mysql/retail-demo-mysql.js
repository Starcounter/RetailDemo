// https://github.com/strongloop/express
// npm install express body-parser mysql --save

var listen_port = '3000';
var db_config = {
    socketPath: '/var/run/mysqld/mysqld.sock',
    user: 'retail',
    password: 'xyzzy',
    database: 'retail',
}

var inspect = require('util').inspect;
var express = require('express')
var bodyParser = require('body-parser');
var mysql = require('mysql');
var c = mysql.createConnection(db_config);
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function run_query(res, next_query, callback) {
    res.run_query_rows = [];
    c.query(next_query)
    .on('error', function(err) {
        console.log(next_query);
        console.log(err);
        res.status(500);
        callback(err);
    })
    .on('result', function(row) {
        res.run_query_rows.push(row);
    })
    .on('end', function(info) {
        callback(res.run_query_rows);
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
                "DROP TABLE IF EXISTS ClientStats",
                "DROP TABLE IF EXISTS Account",
                "DROP TABLE IF EXISTS Customer",

                "CREATE TABLE IF NOT EXISTS Customer (CustomerId INT PRIMARY KEY, FullName VARCHAR(32) NOT NULL, INDEX FullNameIndex (FullName))",
                "CREATE TABLE IF NOT EXISTS Account (AccountId INT PRIMARY KEY, AccountType INT DEFAULT 0, Balance INT DEFAULT 0, CustomerId INT NOT NULL, FOREIGN KEY (CustomerId) REFERENCES Customer(CustomerId) ON DELETE CASCADE)",
                "CREATE TABLE IF NOT EXISTS ClientStats (Received TIMESTAMP, ClientIp VARCHAR(32), NumFails INT, NumOk INT, PRIMARY KEY (Received, ClientIp))",

                "DROP PROCEDURE IF EXISTS AccountBalanceTransfer",
                "CREATE PROCEDURE AccountBalanceTransfer (fromId INT, toId INT, amount INT) NOT DETERMINISTIC MODIFIES SQL DATA SQL SECURITY DEFINER" +
                "  BEGIN" +
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

app.get("/addstats", function (req, res) {
    c.query("INSERT INTO ClientStats VALUES (NOW(), "+c.escape(req.ip)+", "+c.escape(req.query.numFail)+", "+c.escape(req.query.numOk)+")")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('end', function() {
        res.sendStatus(200);
    })
});

app.get("/stats", function (req, res) {
    res.ClientInfos = [];
    c.query("SELECT * FROM ClientStats")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(row) {
        res.ClientInfos.push(row);
    })
    .on('end', function(info) {
        res.json(res.ClientInfos);
    })
});

app.get("/serverAggregates", function (req, res) {
    c.query("SELECT SUM(Balance) AS AccountBalanceTotal FROM Account")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(row) {
        res.send('AccountBalanceTotal=' + row.AccountBalanceTotal);
    })
});


app.post("/customers/:id", function (req, res) {
    res.query_list = ["INSERT INTO Customer VALUES (" + c.escape(req.params.id) + ", " + c.escape(req.body.FullName) + ")"];
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

app.get("/customers/:id", function (req, res) {
    res.query_result = null;
    c.query('SELECT * FROM Customer WHERE CustomerId = ' + c.escape(req.params.id))
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(row) {
        res.query_result = row;
    })
    .on('end', function() {
        if (res.query_result)
            res.json(res.query_result);
        else
            res.sendStatus(404);
    })
});

app.get("/customers", function (req, res) {
    res.query_result = [];
    c.query("SELECT * FROM Customer WHERE FullName = " +c.escape(req.query.f))
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(row) {
        res.query_result.push(row);
    })
    .on('end', function() {
        if (!res.query_result)
            res.sendStatus(404);
        else
            res.json(res.query_result);
    })
});

app.get("/dashboard/:id", function (req, res) {
    res.query_result = false;
    c.query("SELECT * FROM Customer WHERE CustomerId = " + c.escape(req.params.id))
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(customer_row) {
        res.query_result = customer_row;
        customer_row.Accounts = [];
        c.query("SELECT * FROM Account WHERE CustomerId = " + c.escape(customer_row.CustomerId))
        .on('result', function(account_row) {
            customer_row.Accounts.push(account_row);
        })
        .on('end', function(info) {
            res.json(res.query_result);
        })
    })
});

function why_transfer_fail(req, res) {
    c.query("SELECT Balance FROM Account WHERE AccountId = " + c.escape(req.query.f), function (err, rows) {
        if (err) {
            console.log('pq_balance (will retry): ' + err.code);
            setTimeout(do_the_transfer, 1000, req, res);
        } else {
            if (rows.length < 1 ) {
                res.status(400).send('Source account missing: ' + req.query.f);
            } else if (rows[0].Balance < req.query.x) {
                console.log('why_transfer_fail: insufficient funds');
                if (!res.headersSent)
                    res.status(400).send('Insufficient funds on source account');
            } else {
                // check that the destination account exists
                c.query("SELECT * FROM Account WHERE AccountId = " + c.escape(req.query.t), function (err, rows) {
                    if (err) {
                        console.log('Retrying transfer ' + req.query);
                        setTimeout(do_the_transfer, 1000, req, res);
                    } else {
                        if (rows.length !== 1) {
                            res.status(400).send('Destination account missing: ' + req.query.t);
                        } else {
                            console.log('Retrying transfer ' + req.query);
                            setTimeout(do_the_transfer, 1000, req, res);
                        }
                    }
                });
            }
        }
    });
}

function do_the_transfer(req, res) {
    c.query("CALL AccountBalanceTransfer("+c.escape(req.query.f)+", "+c.escape(req.query.t)+", "+c.escape(req.query.x)+")", function (err, dbres) {
        if (err) {
            console.log('pq_transfer (will retry): ' + err.code);
            setTimeout(do_the_transfer, 1000, req, res);
        } else {
            if (dbres[0][0].Success === 1) {
                res.status(200).send('Transfer OK');
            } else {
                why_transfer_fail(req, res);
            }
        }
    });
}

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
    res.send("Listening for queries\r\n");
})


function connect_to_db() {
    /*
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
    */
}

if (!module.parent) {
    var args = process.argv.slice(2);
    for (n in args) {
        listen_port = args[n];
    }
    if (db_config.socketPath)
        console.log('Using database config "' + db_config.user + ' @ unix:' + db_config.socketPath + '"');
    else
        console.log('Using database config "' + db_config.user + ' @ tcp:' + db_config.host + '"');
    connect_to_db();
    console.log('Starting application on port ' + listen_port);
    app.listen(listen_port);
}
