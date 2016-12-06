IF "%Configuration%"=="" set Configuration=%1

SET RetailClientExe=Client\bin\%Configuration%\RetailClient.exe
SET RetailServerExe=Starcounter\bin\%Configuration%\ScRetailDemo.exe

:: Test parameters.
SET NumberOfCustomers=10000
SET NumberOfWorkers=4
SET NumberOfOperations=300000

SET DB_NAME=default

:: Killing existing processes.
"%StarcounterBin%/staradmin.exe" kill all

:: Starting the host to be able to delete database.

ECHO Starting %RetailServerExe% on database %DB_NAME%
star.exe -database=%DB_NAME% %RetailServerExe%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Stopping existing database %DB_NAME%
staradmin --database=%DB_NAME% stop db
IF ERRORLEVEL 1 GOTO FAILED

ECHO Deleting existing database %DB_NAME%
staradmin --database=%DB_NAME% delete --force db
IF ERRORLEVEL 1 GOTO FAILED

:: Starting server application.

ECHO Starting %RetailServerExe% on database %DB_NAME%
star.exe -database=%DB_NAME% %RetailServerExe%
IF ERRORLEVEL 1 GOTO FAILED

:: Using aggregation.

ECHO Inserting %NumberOfCustomers% objects using aggregation and %NumberOfWorkers% workers.
%RetailClientExe% -Inserting=True -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0 -NumWorkersPerServerEndpoint=%NumberOfWorkers%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Getting customers by ID using aggregation.
%RetailClientExe% -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=%NumberOfOperations% -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using aggregation.
%RetailClientExe% -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=%NumberOfOperations% -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Mixed transactions using aggregation.
%RetailClientExe% -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=%NumberOfOperations% -NumGetCustomerAndAccounts=%NumberOfOperations% -NumGetCustomerById=%NumberOfOperations% -NumGetCustomerByFullName=%NumberOfOperations%
IF ERRORLEVEL 1 GOTO FAILED


:: Using asyncronous Node.

ECHO Inserting %NumberOfCustomers% objects using asyncronous node and %NumberOfWorkers% workers.
%RetailClientExe% -Inserting=True -NumCustomers=%NumberOfCustomers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0  -NumWorkersPerServerEndpoint=%NumberOfWorkers%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Getting customers by ID using asyncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=%NumberOfOperations% -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using asyncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=%NumberOfOperations% -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Mixed transactions using asyncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=%NumberOfOperations% -NumGetCustomerAndAccounts=%NumberOfOperations% -NumGetCustomerById=%NumberOfOperations% -NumGetCustomerByFullName=%NumberOfOperations%
IF ERRORLEVEL 1 GOTO FAILED


:: Using syncronous Node.

ECHO Inserting %NumberOfCustomers% objects using syncronous Node and %NumberOfWorkers% workers.
%RetailClientExe% -Inserting=True -NumCustomers=%NumberOfCustomers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0  -NumWorkersPerServerEndpoint=%NumberOfWorkers%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Getting customers by ID using syncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=%NumberOfOperations% -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using syncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=%NumberOfOperations% -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Mixed transactions using syncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=%NumberOfOperations% -NumGetCustomerAndAccounts=%NumberOfOperations% -NumGetCustomerById=%NumberOfOperations% -NumGetCustomerByFullName=%NumberOfOperations%
IF ERRORLEVEL 1 GOTO FAILED

POPD

ECHO Deleting database %DB_NAME%

staradmin --database=%DB_NAME% stop db
IF ERRORLEVEL 1 GOTO FAILED

staradmin --database=%DB_NAME% delete --force db
IF ERRORLEVEL 1 GOTO FAILED

:: Build finished successfully.
ECHO RetailDemo test finished successfully!

"%StarcounterBin%/staradmin.exe" kill all

GOTO :EOF

:: If we are here than some test has failed.
:FAILED

SET EXITCODE=%ERRORLEVEL%

:: Ending sequence.
POPD
"%StarcounterBin%/staradmin.exe" kill all
ECHO Exiting build with error code %EXITCODE%!
EXIT /b %EXITCODE%
