// https://www.npmjs.org/package/mariasql
// https://github.com/strongloop/express


var db_config = {
    host: '127.0.0.1',
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
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.get('/init', function (req, res) {
    // Create tables and make sure they're empty
    c.query("CREATE TABLE IF NOT EXISTS Customer (CustomerId INT PRIMARY KEY, FullName VARCHAR(32), INDEX FullNameIndex (FullName))")
    .on('error', function(err) {
        res.status(500).send(err.message);
    })
    .on('result', function(dbres) {
        c.query("CREATE TABLE IF NOT EXISTS Account (AccountId INT PRIMARY KEY, CustomerId INT, Balance INT, FOREIGN KEY (CustomerId) REFERENCES Customer(CustomerId) ON DELETE CASCADE)")
        .on('error', function(err) {
            res.status(500).send(err.message);
        })
        .on('result', function(dbres) {
            c.query("DELETE FROM Customer");
            c.query("DELETE FROM Account");
        })
        .on('end', function(dbres) {
            res.send('Initialized.');
        })
    })
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
            res.send('AccountBalanceTotal=' + row.Total)
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
    res.json(req.body)
});

/*
Handle.GET("/customers/{?}", (int customerId) => {
    var json = new CustomerJson();
    json.Data = Db.SQL("SELECT p FROM Customer p WHERE CustomerId = ?", customerId).First;
    return new Response() { BodyBytes = json.ToJsonUtf8() };
});
*/
app.get("/customers/:id", function (req, res) {
    c.query("SELECT * FROM Customer WHERE CustomerId = " + c.escape(req.params.id))
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

Handle.GET("/customers?f={?}", (string fullName) => {
    var json = new CustomerJson();
    json.Data = Db.SQL("SELECT p FROM Customer p WHERE FullName = ?", fullName).First;
    return new Response() { BodyBytes = json.ToJsonUtf8() };
});


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
