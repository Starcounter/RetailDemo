// https://www.npmjs.org/package/mariasql
// https://github.com/strongloop/express

var listen_port = '3000';
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
                "CREATE TABLE IF NOT EXISTS Customer (CustomerId INT PRIMARY KEY, FullName VARCHAR(32) NOT NULL, INDEX FullNameIndex (FullName))",
                "CREATE TABLE IF NOT EXISTS Account (AccountId INT PRIMARY KEY, AccountType INT DEFAULT 0, Balance INT DEFAULT 0, CustomerId INT NOT NULL, FOREIGN KEY (CustomerId) REFERENCES Customer(CustomerId) ON DELETE CASCADE)",
                "CREATE TABLE IF NOT EXISTS ClientStats (Received TIMESTAMP, ClientIp VARCHAR(32), NumFails INT, NumOk INT)",
                "DELETE FROM Account",
                "DELETE FROM Customer",
                "DELETE FROM ClientStats",
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
    res.status(204);
    process_query_list(res, res.query_list.shift());
});

// /addstats?numFail=X&numOk=Y
app.get("/addstats", function (req, res) {
    c.query("INSERT INTO ClientStats VALUES (NOW(), ?, ?, ?)", [req.ip, req.query.numFail, req.query.numOk], true)
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

/*
// Getting client statistics.
Handle.GET("/stats", () => {

    List<String> list = new List<String>();

    lock (statsLocker_) {

        // Printing information about each client.
        foreach (KeyValuePair<String, ClientStats> k in clientsStats_) {

            String s = String.Format("\"ClientIp\":\"{0}\",\"TotalResponses\":\"{1}\",\"ApproximateRps\":\"{2}\"",
                k.Key, k.Value.NumResponses, k.Value.RPS);

            list.Add("{" + s + "}");
        }
    }

    return "{\"ClientInfos\":[" + String.Join(",", list.ToArray()) + "]}";
});
*/
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
    c.query("SELECT SUM(Balance) AS Total FROM Account")
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres.on('row', function(row) {
            res.send('AccountBalanceTotal=' + row.Total);
        })
    })
});


app.post("/customers/:id", function (req, res) {
    res.query_list = ["INSERT INTO Customer VALUES (" + req.params.id + ", '" + c.escape(req.body.FullName) + "')"];
    for (n in req.body.Accounts) {
        if (typeof req.body.Accounts[n].AccountType == 'undefined')
            req.body.Accounts[n].AccountType = 0;
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
    c.query("SELECT * FROM Customer WHERE CustomerId = ?", [req.params.id])
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

app.get("/dashboard/:id", function (req, res) {
    c.query("SELECT * FROM Customer WHERE CustomerId = ?", [req.params.id])
    .on('error', function(err) {
        console.log(err);
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

app.get("/customers", function (req, res) {
    c.query("SELECT * FROM Customer WHERE FullName = ?", [req.query.f])
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        res.query_result = [];
        dbres
        .on('row', function(row) {
            res.query_result.push(row);
        })
        .on('end', function(info) {
            if (!info.numRows) {
                res.sendStatus(404);
            } else {
                res.json(res.query_result);
            }
        })
    })
});

app.get("/transfer", function (req, res) {
    c.query("CALL AccountBalanceTransfer(?, ?, ?)", [req.query.f, req.query.t, req.query.x], true)
    .on('error', function(err) {
        console.log(err);
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        dbres
        .on('error', function(err) {
            console.log(err);
            res.status(500).send(err.message);
        })
    })
    .on('end', function(info) {
        res.sendStatus(200);
    })
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
    var args = process.argv.slice(2);
    for (n in args) {
        listen_port = args[n];
    }
    console.log('Using database config "' + db_config.user + '@' + db_config.host + '"');
    c.connect(db_config);
    c.on('connect', function() {
        console.log('Starting application on port ' + listen_port);
        app.listen(listen_port);
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
