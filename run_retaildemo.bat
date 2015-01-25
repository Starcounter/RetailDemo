IF "%CheckoutDir%"=="" set CheckoutDir=%cd%
IF "%SC_CHECKOUT_DIR%"=="" set SC_CHECKOUT_DIR=%CheckoutDir%

SET MsbuildExe=C:\Windows\Microsoft.NET\Framework\v4.0.30319\msbuild.exe
SET NumberOfCustomers=1000
SET NumberOfWorkers=4
SET Configuration=Debug
SET RetailClientExe=RetailDemo\Client\bin\%Configuration%\RetailClient.exe
SET RetailServerExe=RetailDemo\Starcounter\bin\%Configuration%\ScRetailDemo.exe

:: Killing existing processes.
"%StarcounterBin%/staradmin.exe" kill all

:: Pulling repository.

ECHO Cloning RetailDemo repository.
PUSHD "%SC_CHECKOUT_DIR%"
git clone https://github.com/Starcounter/RetailDemo.git --branch develop RetailDemo
IF ERRORLEVEL 1 GOTO FAILED

:: Building repository.

ECHO Building RetailDemo solution.
"%MsbuildExe%" "RetailDemo/RetailDemo.sln" /p:Configuration=%Configuration%
IF ERRORLEVEL 1 GOTO FAILED

:: Starting server application.

star.exe %RetailServerExe%
IF ERRORLEVEL 1 GOTO FAILED

:: Using aggregation.

ECHO Inserting %NumberOfCustomers% objects using aggregation and %NumberOfWorkers% workers.
%RetailClientExe% -Inserting=True -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0 -NumWorkersPerServerEndpoint=%NumberOfWorkers%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Getting customers by ID using aggregation.
%RetailClientExe% -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=1000000 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using aggregation.
%RetailClientExe% -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=1000000 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using aggregation.
%RetailClientExe% -UseAggregation=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=1000000 -NumGetCustomerAndAccounts=1000000 -NumGetCustomerById=1000000 -NumGetCustomerByFullName=1000000
IF ERRORLEVEL 1 GOTO FAILED


:: Using asyncronous Node.

ECHO Inserting %NumberOfCustomers% objects using asyncronous node and %NumberOfWorkers% workers.
%RetailClientExe% -Inserting=True -DoAsyncNode=True -NumCustomers=%NumberOfCustomers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0  -NumWorkersPerServerEndpoint=%NumberOfWorkers%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Getting customers by ID using asyncronous Node.
%RetailClientExe% -DoAsyncNode=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=1000000 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using asyncronous Node.
%RetailClientExe% -DoAsyncNode=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=1000000 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using asyncronous Node.
%RetailClientExe% -DoAsyncNode=True -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=1000000 -NumGetCustomerAndAccounts=1000000 -NumGetCustomerById=1000000 -NumGetCustomerByFullName=1000000
IF ERRORLEVEL 1 GOTO FAILED


:: Using syncronous Node.

ECHO Inserting %NumberOfCustomers% objects using syncronous Node and %NumberOfWorkers% workers.
%RetailClientExe% -Inserting=True -NumCustomers=%NumberOfCustomers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0  -NumWorkersPerServerEndpoint=%NumberOfWorkers%
IF ERRORLEVEL 1 GOTO FAILED

ECHO Getting customers by ID using syncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=0 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=1000000 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using syncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=1000000 -NumGetCustomerAndAccounts=0 -NumGetCustomerById=0 -NumGetCustomerByFullName=0
IF ERRORLEVEL 1 GOTO FAILED

ECHO Transfering money between accounts using syncronous Node.
%RetailClientExe% -NumCustomers=%NumberOfCustomers% -NumWorkersPerServerEndpoint=%NumberOfWorkers% -NumTransferMoneyBetweenTwoAccounts=1000000 -NumGetCustomerAndAccounts=1000000 -NumGetCustomerById=1000000 -NumGetCustomerByFullName=1000000
IF ERRORLEVEL 1 GOTO FAILED

"%StarcounterBin%/staradmin.exe" kill all
POPD

:: Build finished successfully.
GOTO :EOF

:: If we are here than some test has failed.
:FAILED

SET EXITCODE=%ERRORLEVEL%

:: Ending sequence.
POPD
"%StarcounterBin%/staradmin.exe" kill all
ECHO Exiting build with error code %EXITCODE%!
EXIT /b %EXITCODE%
