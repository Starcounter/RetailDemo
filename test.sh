curl -v http://aardvark:3000/init
curl -v -H "Content-Type: application/json" http://aardvark:3000/customers/1 --data-binary '{ "CustomerId": 1, "FullName": "FooOne", "Accounts": [ { "AccountId": 1001, "AccountType": 0, "Balance": 1000 } ] }'
curl -v -H "Content-Type: application/json" http://aardvark:3000/customers/2 --data-binary '{ "CustomerId": 2, "FullName": "FooTwo", "Accounts": [ { "AccountId": 2001, "AccountType": 0, "Balance": 1000 } ] }'
curl -v -H "Content-Type: application/json" http://aardvark:3000/customers/3 --data-binary '{ "CustomerId": 3, "FullName": "FooThree", "Accounts": [ { "AccountId": 3001, "AccountType": 0, "Balance": 1000 } ] }'
curl -v 'http://aardvark:3000/transfer?f=1001&t=2001&x=1000'
curl -v 'http://aardvark:3000/transfer?f=2001&t=1001&x=1000'
