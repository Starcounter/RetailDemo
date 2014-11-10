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
var pool = mysql.createPool(db_config);
var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function run_query(res, next_query, callback) {
    res.run_query_rows = [];
    pool.query(next_query)
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
            console.log(res.statusCode + ": " + res.query_results);
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
    pool.query("INSERT INTO ClientStats VALUES (NOW(), "+pool.escape(req.ip)+", "+pool.escape(req.query.numFail)+", "+pool.escape(req.query.numOk)+")", function (err, dbres) {
       if (err) {
           console.log(err);
           res.status(500).send(err.code);
       } else {
           res.sendStatus(200);
       }
    });
});

app.get("/stats", function (req, res) {
    res.ClientInfos = [];
    pool.query("SELECT * FROM ClientStats", function (err, dbres) {
        if (err) {
            console.log(err);
            res.status(500).send(err.code);
        } else {
            res.json(dbres[0]);
        }
    });
});

app.get("/serverAggregates", function (req, res) {
    pool.query("SELECT SUM(Balance) AS AccountBalanceTotal FROM Account", function (err, dbres) {
        if (err) {
            console.log(err);
            res.status(500).send(err.code);
        } else {
            if (dbres[0])
                res.send('AccountBalanceTotal=' + dbres[0].AccountBalanceTotal);
            else
                res.sendStatus(404);
        }
    });
});


app.post("/customers/:id", function (req, res) {
    res.query_list = ["INSERT INTO Customer VALUES (" + pool.escape(req.params.id) + ", " + pool.escape(req.body.FullName) + ")"];
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
    pool.query('SELECT * FROM Customer WHERE CustomerId = ' + pool.escape(req.params.id), function (err, dbres) {
        if (err) {
            console.log(err);
            res.status(500).send(err.code);
        } else {
            if (dbres[0])
                res.json(dbres[0]);
            else
                res.sendStatus(404);
        }
    });
});

app.get("/customers", function (req, res) {
    res.query_result = [];
    pool.query("SELECT * FROM Customer WHERE FullName = " +pool.escape(req.query.f), function (err, dbres) {
        if (err) {
            console.log(err);
            res.status(500).send(err.code);
        } else {
            if (dbres[0])
                res.json(dbres[0]);
            else
                res.sendStatus(404);
        }
    });
});

app.get("/dashboard/:id", function (req, res) {
    res.query_result = false;
    pool.query("SELECT * FROM Customer WHERE CustomerId = " + pool.escape(req.params.id), function (err, dbres) {
        if (err) {
            console.log(err);
            res.status(500).send(err.code);
        } else {
            if (dbres[0]) {
                res.query_result = dbres[0];
                res.query_result.Accounts = [];
                pool.query("SELECT * FROM Account WHERE CustomerId = " + pool.escape(res.query_result.CustomerId), function(err, dbres) {
                    if (err) {
                        console.log(err);
                    } else {
                        res.query_result.Accounts.push(dbres[0]);
                        res.json(res.query_result);
                    }
                });
            } else {
                res.sendStatus(404);
            }
        }
    });
});

function why_transfer_fail(req, res) {
    pool.query("SELECT Balance FROM Account WHERE AccountId = " + pool.escape(req.query.f), function (err, rows) {
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
                pool.query("SELECT * FROM Account WHERE AccountId = " + pool.escape(req.query.t), function (err, rows) {
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
    pool.getConnection(function(err, conn) {
        if (err) {
            console.log('pq_transfer:getConnection (will retry): ' + err.code);
            setTimeout(do_the_transfer, 1000, req, res);
        } else {
            conn.beginTransaction(function(err) {
              if (err) {
                  console.log('pq_transfer:beginTransaction (will retry): ' + err.code);
                  conn.release(); setTimeout(do_the_transfer, 1000, req, res);
              } else {
                  var fromId = pool.escape(req.query.f);
                  var toId = pool.escape(req.query.t);
                  var amount = pool.escape(req.query.x);
                  conn.query("SELECT * FROM Account WHERE AccountId IN (" + fromId + ", " + toId + ") FOR UPDATE", function (err, rows) {
                      if (err) {
                          console.log('pq_transfer:SELECT (will retry): ' + err.code);
                          conn.release(); setTimeout(do_the_transfer, 100, req, res);
                      } else {
                          if (rows.length < 1 || rows.length > 2) {
                              res.status(400).send('No such AccountId');
                          } else if (rows.length !== 2) {
                              if (rows[0].AccountId === req.query.f)
                                  res.status(400).send('Target AccountId invalid');
                              else
                                  res.status(400).send('Source AccountId invalid');
                          } else {
                              var fromIndex = 0;
                              if (rows[1].AccountId === req.query.f)
                                  fromIndex = 1;
                              if (rows[fromIndex].Balance < req.query.x) {
                                  res.status(400).send('Insufficient funds on source account');
                              }
                          }

                          if (res.headersSent) {
                              // if headers sent, SELECT found the transaction not possible, so end here
                              conn.commit(function(err) {
                                if (err) {
                                    console.log('pq_transfer:select:commit: ' + err.code);
                                    conn.rollback(function() { conn.release(); });
                                } else {
                                    conn.release();
                                }
                              });
                          } else {
                              var update_query_str =
                                      "    UPDATE Account SET Balance = Balance + (" +
                                      "      SELECT CASE " +
                                      "        WHEN AccountId = "+ fromId +
                                      "           THEN -" + amount +
                                      "           ELSE "+ amount +
                                      "        END" +
                                      "      )" +
                                      "    WHERE" +
                                      "      (AccountId = "+ fromId +" AND Balance - "+ amount +" >= 0)" +
                                      "      OR (AccountId = "+ toId +" AND Balance + "+ amount +" >= 0)"
                                      ;
                              conn.query(update_query_str, function(err, dbres) {
                                  if (err) {
                                      console.log('pq_transfer:query (will retry): ' + err.code);
                                      conn.rollback(function() { conn.release(); setTimeout(do_the_transfer, 10, req, res); });
                                  } else {
                                      if (dbres.changedRows === 2) {
                                          // commit the transaction
                                          conn.commit(function(err) {
                                            if (err) {
                                                if (err.code !== 'ER_LOCK_DEADLOCK')
                                                    console.log('pq_transfer:commit (will retry): ' + err.code);
                                                conn.rollback(function() { conn.release(); setTimeout(do_the_transfer, 10, req, res); });
                                            } else {
                                                conn.release();
                                                res.status(200).send('Transfer OK');
                                            }
                                          });
                                      } else {
                                          console.log("/transfer affected " + dbres.changedRows + ", rolling back");
                                          conn.rollback(function() { conn.release(); why_transfer_fail(req, res); });
                                      }
                                  }
                              });
                          }
                      }
                  });
              }
            });
        }
        /*
            conn.query("CALL AccountBalanceTransfer("+pool.escape(req.query.f)+", "+pool.escape(req.query.t)+", "+pool.escape(req.query.x)+")", function (err, dbres) {
                if (err) {
                    console.log('pq_transfer (will retry): ' + err.code);
                    conn.destroy();
                    do_the_transfer(req, res);
                } else {
                    var success = dbres[0][0].Success;
                    conn.release();
                    if (success === 1) {
                        res.status(200).send('Transfer OK');
                    } else {
                        why_transfer_fail(req, res);
                    }
                }
            });
        }
    */
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

app.get('/', function (req, res) {
    res.send("Listening for queries\r\n");
})

if (!module.parent) {
    var args = process.argv.slice(2);
    for (n in args) {
        listen_port = args[n];
    }
    if (db_config.socketPath)
        console.log('Using database config "' + db_config.user + ' @ unix:' + db_config.socketPath + '"');
    else
        console.log('Using database config "' + db_config.user + ' @ tcp:' + db_config.host + '"');
    console.log('Starting application on port ' + listen_port);
    app.listen(listen_port);
}
