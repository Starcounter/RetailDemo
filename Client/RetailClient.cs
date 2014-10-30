#define INSERT_ONLY
using Starcounter;
using Starcounter.Internal;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace PokerDemoConsole {

    class Settings {

        public const String Separator = "----------------------------------";
        public const Int32 MaxAccountsPerCustomer = 5;
        public const Int32 MinInitialBalance = 10;
        public const Int32 MaxInitialBalance = 100000;
        public const Int32 MaxTransferAmount = 1000;
        public const Int32 SendStatsNumSeconds = 10;
        
        public Int32 NumCustomers = 100000;

#if INSERT_ONLY

        public Int32 NumTransferMoneyBetweenTwoAccounts = 0;
        public Int32 NumGetCustomerAndAccounts = 0;
        public Int32 NumGetCustomerById = 0;
        public Int32 NumGetCustomerByFullName = 0;
        public Boolean Inserting = true;
#else

        public Int32 NumTransferMoneyBetweenTwoAccounts = 1000000;
        public Int32 NumGetCustomerAndAccounts = 1000000;
        public Int32 NumGetCustomerById = 1000000;
        public Int32 NumGetCustomerByFullName = 1000000;
        public Boolean Inserting = false;

#endif
        
        public Int32 NumWorkers = 1;
        public UInt16 ServerPort = 8080;
        public UInt16 AggregationPort = 9191;
        public String ServerIp = "127.0.0.1";
        public TestTypes TestType = TestTypes.PokerDemo;
        public Int32 NumTestRequestsEachWorker = 5000000;

        /// <summary>
        /// This local IP address.
        /// </summary>
        static IPAddress localIpAddress_ = null;

        /// <summary>
        /// IP address of the this machine.
        /// </summary>
        public static IPAddress LocalIPAddress {

            get {

                if (null != localIpAddress_)
                    return localIpAddress_;

                IPHostEntry host = Dns.GetHostEntry(Dns.GetHostName());

                foreach (IPAddress ip in host.AddressList) {

                    if (ip.AddressFamily == AddressFamily.InterNetwork) {

                        localIpAddress_ = ip;
                        return localIpAddress_;
                    }
                }

                return null;
            }
        }

        public void Init(string[] args)
        {
            if (args.Length == 1) {

                if ((args[0] == "?") ||
                    (args[0] == "help") ||
                    (args[0] == "/help") ||
                    (args[0] == "--help")) {

                    Console.WriteLine("=== Retail Demo client parameters ===");

                    Console.WriteLine("-NumCustomers=[0, 1000000]");
                    Console.WriteLine("-NumTransferMoneyBetweenTwoAccounts=[0, 10000000]");
                    Console.WriteLine("-NumGetCustomerAndAccounts=[0, 10000000]");
                    Console.WriteLine("-NumGetCustomerById=[0, 10000000]");
                    Console.WriteLine("-NumGetCustomerByFullName=[0, 10000000]");

                    Console.WriteLine("-NumWorkers=1");
                    Console.WriteLine("-ServerIp=127.0.0.1");
                    Console.WriteLine("-ServerPort=8080");
                    Console.WriteLine("-AggregationPort=9191");
                    Console.WriteLine("-NumTestRequestsEachWorker=5000000");
                    Console.WriteLine("-Inserting=False");
                    Console.WriteLine("-TestType=[PokerDemo, Gateway, Echo, GatewayNoIPC, GatewayAndIPC, GatewayNoIPCNoChunks]");

                    Environment.Exit(0);
                }
            }

            foreach (String arg in args)
            {
                if (arg.StartsWith("-NumCustomers=")) {
                    NumCustomers = Int32.Parse(arg.Substring("-NumCustomers=".Length));

                } else if (arg.StartsWith("-NumTransferMoneyBetweenTwoAccounts=")) {
                    NumTransferMoneyBetweenTwoAccounts = Int32.Parse(arg.Substring("-NumTransferMoneyBetweenTwoAccounts=".Length));

                } else if (arg.StartsWith("-NumGetCustomerAndAccounts=")) {
                    NumGetCustomerAndAccounts = Int32.Parse(arg.Substring("-NumGetCustomerAndAccounts=".Length));

                } else if (arg.StartsWith("-NumGetCustomerById=")) {
                    NumGetCustomerById = Int32.Parse(arg.Substring("-NumGetCustomerById=".Length));

                } else if (arg.StartsWith("-NumGetCustomerByFullName=")) {
                    NumGetCustomerByFullName = Int32.Parse(arg.Substring("-NumGetCustomerByFullName=".Length));

                } else if (arg.StartsWith("-NumWorkers=")) {
                    NumWorkers = Int32.Parse(arg.Substring("-NumWorkers=".Length));

                } else if (arg.StartsWith("-ServerIp=")) {
                    ServerIp = arg.Substring("-ServerIp=".Length);

                } else if (arg.StartsWith("-ServerPort=")) {
                    ServerPort = UInt16.Parse(arg.Substring("-ServerPort=".Length));

                } else if (arg.StartsWith("-AggregationPort=")) {
                    AggregationPort = UInt16.Parse(arg.Substring("-AggregationPort=".Length));

                } else if (arg.StartsWith("-NumTestRequestsEachWorker=")) {
                    NumTestRequestsEachWorker = Int32.Parse(arg.Substring("-NumTestRequestsEachWorker=".Length));

                } else if (arg.StartsWith("-Inserting=")) {
                    Inserting = Boolean.Parse(arg.Substring("-Inserting=".Length));

                } else if (arg.StartsWith("-TestType=")) {
                    TestType = (TestTypes)Int32.Parse(arg.Substring("-TestType=".Length));

                } else {
                    throw new ArgumentException("Unrecognized argument supplied: " + arg);
                }
            }

            // Checking correctness of parameters.
            if ((NumCustomers < 0) ||
                (NumTransferMoneyBetweenTwoAccounts < 0) ||
                (NumGetCustomerAndAccounts < 0) ||
                (NumGetCustomerById < 0) ||
                (NumGetCustomerByFullName < 0)) {

                throw new ArgumentException("Wrong input parameters!");
            }

            // Checking if we are inserting new objects.
            if (Inserting) {

                if (NumWorkers > 1) {
                    throw new ArgumentException("Inserting but NumWorkers > 1");
                }

                if (NumCustomers <= 0) {
                    throw new ArgumentException("Inserting but NumCustomers <= 0");
                }

                if ((NumTransferMoneyBetweenTwoAccounts > 0) ||
                    (NumGetCustomerAndAccounts > 0) ||
                    (NumGetCustomerById > 0) ||
                    (NumGetCustomerByFullName > 0)) {

                    throw new ArgumentException("Inserting new customers but trying to do other transactions as well.");
                }
            }

            Console.WriteLine("NumWorkers: " + NumWorkers);
            Console.WriteLine("ServerIp: " + ServerIp);
            Console.WriteLine("ServerPort: " + ServerPort);
            Console.WriteLine("AggregationPort: " + AggregationPort);
            Console.WriteLine("TestType: " + TestType);
            Console.WriteLine("NumTestRequestsEachWorker: " + NumTestRequestsEachWorker);
            Console.WriteLine();

            Console.WriteLine("Inserting: " + Inserting);
            Console.WriteLine("NumInsertCustomers: " + NumCustomers);
            Console.WriteLine("NumTransferMoneyBetweenTwoAccounts: " + NumTransferMoneyBetweenTwoAccounts);
            Console.WriteLine("NumGetCustomerAndAccounts: " + NumGetCustomerAndAccounts);
            Console.WriteLine("NumGetCustomerById: " + NumGetCustomerById);
            Console.WriteLine("NumGetCustomerByFullName: " + NumGetCustomerByFullName);
            Console.WriteLine();
        }
    }

    enum TestTypes {
        PokerDemo,
        Gateway,
        Echo,
        GatewayNoIPC,
        GatewayAndIPC,
        GatewayNoIPCNoChunks
    }

    public class RequestData {

        /// <summary>
        /// Pre-allocated bytes of maximum size where the request will sit.
        /// </summary>
        Byte[] dataBytes_;

        /// <summary>
        /// Number of bytes for request.
        /// </summary>
        Int32 dataLength_;

        /// <summary>
        /// Creating request data with maximum bytes.
        /// </summary>
        /// <param name="maxBytesNum"></param>
        public RequestData(Int32 maxBytesNum) {
            dataBytes_ = new Byte[maxBytesNum];
        }

        /// <summary>
        /// Writing request data to array.
        /// </summary>
        /// <param name="bytes"></param>
        /// <param name="numBytesToWrite"></param>
        public void WriteData(Byte[] bytes, Int32 numBytesToWrite) {
            Buffer.BlockCopy(bytes, 0, dataBytes_, 0, numBytesToWrite);
            dataLength_ = numBytesToWrite;
        }

        public Byte[] DataBytes {
            get {
                return dataBytes_;
            }
        }

        public Int32 DataLength {
            get {
                return dataLength_;
            }
            set {
                dataLength_ = value;
            }
        }
    }

    public interface IRequestsCreator {

        /// <summary>
        /// Getting number of requests.
        /// </summary>
        /// <param name="requestsToFill"></param>
        /// <param name="workerId"></param>
        /// <returns></returns>
        Int32 GetABunchOfRequests(RequestData[] requestsToFill, Int32 workerId);

        /// <summary>
        /// Checking if all requests are processed.
        /// </summary>
        /// <returns></returns>
        Boolean IsDone();

        /// <summary>
        /// Incrementing number of good responses.
        /// </summary>
        /// <param name="num"></param>
        void IncrementTotalGoodResponses(Int32 num);
    }

    enum RequestTypes {
        InsertCustomers,
        TransferMoneyBetweenTwoAccounts,
        GetCustomerAndAccounts,
        GetCustomerById,
        GetCustomerByFullName
    }

    class WorkerSettings {
        public Int32 NumBodyCharacters;
        public CountdownEvent WaitForAllWorkersEvent;
        public Int32 NumGoodResponses;
        public Int32 WorkersRPS;
        public Int32 ExitCode;
    };

    class Worker {

        [StructLayout(LayoutKind.Sequential)]
        public struct AggregationStruct {
            public UInt64 unique_socket_id_;
            public Int32 size_bytes_;
            public UInt32 socket_info_index_;
            public Int32 unique_aggr_index_;
            public UInt16 port_number_;
            public Byte msg_type_;
            public Byte msg_flags_;
        }

        // Size of aggregation structure in bytes.
        readonly Int32 AggregationStructSizeBytes = 0;

        // Sizes of the receive and send buffers.
        const Int32 RecvBufSize = 1024 * 1024 * 16;
        const Int32 SendBufSize = 1024 * 1024 * 16;

        // Number of requests in single send.
        const Int32 NumRequestsInSingleSend = 5000;
        const Int32 RequestResponseBalance = 10000;

        public enum AggregationMessageTypes {
            AGGR_CREATE_SOCKET,
            AGGR_DESTROY_SOCKET,
            AGGR_DATA
        };

        public enum AggregationMessageFlags {
            AGGR_MSG_NO_FLAGS,
            AGGR_MSG_GATEWAY_NO_IPC,
            AGGR_MSG_GATEWAY_AND_IPC,
            AGGR_MSG_GATEWAY_NO_IPC_NO_CHUNKS
        };

        /// <summary>
        /// Id of this worker.
        /// </summary>
        Int32 workerId_;

        /// <summary>
        /// Worker settings.
        /// </summary>
        WorkerSettings ws_;

        /// <summary>
        /// Reference to a global settings.
        /// </summary>
        Settings globalSettings_;

        /// <summary>
        /// Special request for gateway test.
        /// </summary>
        Request gwRequest_;

        /// <summary>
        /// Special request for echo test.
        /// </summary>
        Request echoRequest_;

        /// <summary>
        /// Constructor.
        /// </summary>
        /// <param name="workerId"></param>
        /// <param name="ws"></param>
        public Worker(Int32 workerId, WorkerSettings ws, Settings globalSettings) {

            workerId_ = workerId;
            ws_ = ws;
            globalSettings_ = globalSettings;

            if ((globalSettings.NumTestRequestsEachWorker % NumRequestsInSingleSend) != 0) {
                throw new Exception("(globalSettings.NumRequestsEachWorker % NumRequestsInSingleSend) != 0");
            }

            unsafe {
                AggregationStructSizeBytes = sizeof(AggregationStruct);
            }

            // Creating echo request for each worker.
            gwRequest_ = new Request();
            gwRequest_.Method = "GET";
            gwRequest_.Uri = "/gwtest";
            gwRequest_.ConstructFromFields();

            String body = "";
            for (Int32 i = 0; i < ws_.NumBodyCharacters; i++)
                body += "A";

            echoRequest_ = new Request();
            echoRequest_.Method = "POST";
            echoRequest_.Uri = "/echotest";
            echoRequest_.Body = body;
            echoRequest_.ConstructFromFields();
        }

        /// <summary>
        /// Main worker routine.
        /// </summary>
        /// <param name="rc"></param>
        public unsafe void WorkerRoutine(IRequestsCreator rc) {

            try {

                Socket aggrTcpClient = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);

                try {

                    const int SIO_LOOPBACK_FAST_PATH = (-1744830448);
                    Byte[] OptionInValue = BitConverter.GetBytes(1);

                    aggrTcpClient.IOControl(
                        SIO_LOOPBACK_FAST_PATH,
                        OptionInValue,
                        null);

                } catch {
                    // Simply ignoring the error if fast loopback is not supported.
                }

                aggrTcpClient.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.SendBuffer, 1 << 19);
                aggrTcpClient.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReceiveBuffer, 1 << 19);

                aggrTcpClient.Connect(globalSettings_.ServerIp, globalSettings_.AggregationPort);

                AggregationStruct agsOrig = new AggregationStruct() {
                    port_number_ = globalSettings_.ServerPort,
                    msg_type_ = (Byte) AggregationMessageTypes.AGGR_CREATE_SOCKET
                };

                Byte[] sendBuf = new Byte[SendBufSize],
                    recvBuf = new Byte[RecvBufSize];

                fixed (Byte* p = sendBuf) {
                    *(AggregationStruct*) p = agsOrig;
                }

                aggrTcpClient.Send(sendBuf, AggregationStructSizeBytes, SocketFlags.None);
                Int32 numRecvBytes = aggrTcpClient.Receive(recvBuf);

                if (numRecvBytes != AggregationStructSizeBytes)
                    throw new ArgumentOutOfRangeException("Wrong aggregation data size received.");

                fixed (Byte* p = recvBuf) {
                    agsOrig = *(AggregationStruct*)p;
                }

                if (agsOrig.port_number_ != globalSettings_.ServerPort)
                    throw new ArgumentOutOfRangeException("Wrong aggregation port number received.");

                if (agsOrig.msg_type_ != (Byte) AggregationMessageTypes.AGGR_CREATE_SOCKET)
                    throw new ArgumentOutOfRangeException("Wrong aggregated message type received.");

                Int64 totalNumBodyBytes = 0;
                Int64 totalChecksum = 0;
                Int32 restartOffset = 0;
                Int32 totalNumSentRequests = 0;
                Int64 origChecksum = 0;
                Stopwatch timer = Stopwatch.StartNew();
            
                // Preallocating requests array.
                RequestData[] reqData = new RequestData[NumRequestsInSingleSend];
                for (Int32 i = 0; i < NumRequestsInSingleSend; i++) {
                    reqData[i] = new RequestData(1024);
                }

                // Until we have requests.
                while (true) {
                
SEND_DATA:

                    // Checking if we have any requests.
                    if ((totalNumSentRequests - ws_.NumGoodResponses) <= RequestResponseBalance) {

                        Int32 offset = 0;

                        // Getting requests
                        Int32 numRequestsToSend = 0;

                        switch (globalSettings_.TestType) {

                            case TestTypes.PokerDemo: {
                                numRequestsToSend = rc.GetABunchOfRequests(reqData, workerId_);
                                break;
                            }

                            case TestTypes.Echo:
                            case TestTypes.GatewayNoIPC:
                            case TestTypes.GatewayAndIPC:
                            case TestTypes.GatewayNoIPCNoChunks: {

                                // Checking if we already sent all requests.
                                if (totalNumSentRequests >= globalSettings_.NumTestRequestsEachWorker)
                                    break;

                                // Filling up whole buffer with echo requests.
                                for (Int32 i = 0; i < reqData.Length; i++) {
                                    reqData[i].WriteData(echoRequest_.CustomBytes, echoRequest_.CustomBytesLength);
                                }

                                numRequestsToSend = reqData.Length;

                                break;
                            }

                            case TestTypes.Gateway: {

                                // Checking if we already sent all requests.
                                if (totalNumSentRequests >= globalSettings_.NumTestRequestsEachWorker)
                                    break;

                                // Filling up whole buffer with echo requests.
                                for (Int32 i = 0; i < reqData.Length; i++) {
                                    reqData[i].WriteData(gwRequest_.CustomBytes, gwRequest_.CustomBytesLength);
                                }

                                numRequestsToSend = reqData.Length;

                                break;
                            }
                        }

                        // Checking if we have correct send-receive balance.
                        if (numRequestsToSend > 0) {

                            // Filling up the linear send aggregation buffer.
                            fixed (Byte* p = sendBuf) {

                                // Placing each request in aggregation buffer.
                                for (Int32 rn = 0; rn < numRequestsToSend; rn++) {

                                    Byte[] httpRequestBytes = reqData[rn].DataBytes;
                                    Int32 httpRequestBytesLength = reqData[rn].DataLength;

                                    // Checking that we don't exceed the buffer size.
                                    if (offset + AggregationStructSizeBytes + httpRequestBytesLength >= sendBuf.Length) {
                                        throw new OutOfMemoryException("Increase the size of aggregation send buffer.");
                                    }

                                    AggregationStruct a = agsOrig;
                                    a.unique_aggr_index_ = rn;
                                    a.size_bytes_ = httpRequestBytesLength;
                                    a.msg_type_ = (Byte) AggregationMessageTypes.AGGR_DATA;
                                    a.msg_flags_ = 0;

                                    switch (globalSettings_.TestType) {

                                        case TestTypes.GatewayNoIPC: {
                                            a.msg_flags_ = (Byte) AggregationMessageFlags.AGGR_MSG_GATEWAY_NO_IPC;
                                            break;
                                        }

                                        case TestTypes.GatewayAndIPC: {
                                            a.msg_flags_ = (Byte) AggregationMessageFlags.AGGR_MSG_GATEWAY_AND_IPC;
                                            break;
                                        }

                                        case TestTypes.GatewayNoIPCNoChunks: {
                                            a.msg_flags_ = (Byte) AggregationMessageFlags.AGGR_MSG_GATEWAY_NO_IPC_NO_CHUNKS;
                                            break;
                                        }
                                    }

                                    origChecksum += a.unique_aggr_index_;

                                    *(AggregationStruct*)(p + offset) = a;

                                    Marshal.Copy(httpRequestBytes, 0, new IntPtr(p + offset + AggregationStructSizeBytes), httpRequestBytesLength);
                                    offset += AggregationStructSizeBytes + httpRequestBytesLength;
                                }
                            }

                            // Sending aggregated data.
                            aggrTcpClient.Send(sendBuf, offset, SocketFlags.None);

                            // Increasing total number of requests.
                            totalNumSentRequests += numRequestsToSend;

                        } else {

                            // Checking if all requests/responses were processed.
                            if (rc.IsDone())
                                break;

                            // Waiting a bit.
                            Thread.Sleep(1);
                        }
                    }

                    // Receiving responses.
                    if (aggrTcpClient.Available > 0) {
                        numRecvBytes = aggrTcpClient.Receive(recvBuf, restartOffset, recvBuf.Length - restartOffset, SocketFlags.None);
                    } else {
                        Thread.Sleep(1);
                        goto SEND_DATA;
                    }

                    Debug.Assert(numRecvBytes > 0);

                    numRecvBytes += restartOffset;

                    Int64 numBodyBytes = 0;
                    Int32 numResponses = 0;
                    Int64 checksum = 0;

                    // Checking that responses are correct.
                    CheckResponses(recvBuf, numRecvBytes, out restartOffset, out numResponses, out numBodyBytes, out checksum);

                    // Incrementing counters.
                    ws_.NumGoodResponses += numResponses;
                    rc.IncrementTotalGoodResponses(numResponses);
                    totalNumBodyBytes += numBodyBytes;
                    totalChecksum += checksum;
                }

                timer.Stop();

                // Checking that total checksum is correct.
                if (totalChecksum != origChecksum)
                    throw new Exception("Wrong checksums!");

                aggrTcpClient.Close();

                // Calculating worker RPS.
                ws_.WorkersRPS = (Int32) (ws_.NumGoodResponses * 1000.0 / timer.ElapsedMilliseconds);

                lock (ws_) {

                    Console.WriteLine(String.Format("[{0}]: Took time {1} ms for {2} requests (with {3} responses), meaning worker RPS {4}.",
                        workerId_,
                        timer.ElapsedMilliseconds,
                        totalNumSentRequests,
                        ws_.NumGoodResponses,
                        ws_.WorkersRPS));
                }

            } catch (Exception exc) {

                Console.WriteLine(exc.ToString());

                ws_.ExitCode = 1;

            } finally {

                ws_.WaitForAllWorkersEvent.Signal();
            }
        }

        /// <summary>
        /// Checks responses for correctness.
        /// </summary>
        /// <param name="buf"></param>
        /// <param name="numBytes"></param>
        /// <param name="restartOffset"></param>
        /// <param name="numProcessedResponses"></param>
        /// <param name="numProcessedBodyBytes"></param>
        /// <param name="outChecksum"></param>
        unsafe void CheckResponses(
            Byte[] buf,
            Int32 numBytes,
            out Int32 restartOffset,
            out Int32 numProcessedResponses,
            out Int64 numProcessedBodyBytes,
            out Int64 outChecksum) {

            Int32 numUnprocessedBytes = numBytes, offset = 0;

            numProcessedResponses = 0;
            numProcessedBodyBytes = 0;
            restartOffset = 0;
            outChecksum = 0;

            fixed (Byte* p = buf) {

                while (numUnprocessedBytes > 0) {

                    if (numUnprocessedBytes < AggregationStructSizeBytes) {

                        Buffer.BlockCopy(buf, numBytes - numUnprocessedBytes, buf, 0, numUnprocessedBytes);
                        restartOffset = numUnprocessedBytes;
                        return;
                    }

                    AggregationStruct* ags = (AggregationStruct*)(p + offset);
                    if (ags->port_number_ != globalSettings_.ServerPort)
                        throw new ArgumentOutOfRangeException("ags->port_number_ != globalSettings_.ServerPort");

                    if (numUnprocessedBytes < (AggregationStructSizeBytes + ags->size_bytes_)) {

                        Buffer.BlockCopy(buf, numBytes - numUnprocessedBytes, buf, 0, numUnprocessedBytes);
                        restartOffset = numUnprocessedBytes;
                        return;
                    }

                    // Here we can check for correct response.
                    if ((buf[offset + AggregationStructSizeBytes] != 'H') ||
                        (buf[offset + AggregationStructSizeBytes + 1] != 'T') ||
                        (buf[offset + AggregationStructSizeBytes + 9] != '2')) {

                        String respString = Marshal.PtrToStringAnsi(new IntPtr(p + offset + AggregationStructSizeBytes), ags->size_bytes_);

                        throw new ArgumentOutOfRangeException("Incorrect HTTP response received: " + respString);
                    }

                    outChecksum += ags->unique_aggr_index_;
                    numProcessedBodyBytes += ags->size_bytes_;
                    numProcessedResponses++;

                    numUnprocessedBytes -= AggregationStructSizeBytes + ags->size_bytes_;

                    offset += AggregationStructSizeBytes + ags->size_bytes_;
                }
            }
        }
    }

    /// <summary>
    /// Creating needed requests "on the fly".
    /// </summary>
    class LiveRequestCreator : IRequestsCreator {

        /// <summary>
        /// Total number of good responses.
        /// </summary>
        Int32 totalGoodResponses_ = 0;

        /// <summary>
        /// Total number of requests.
        /// </summary>
        Int32 totalNumPlannedRequests_ = 0;

        /// <summary>
        /// Number of processed requests.
        /// </summary>
        Int32 numProcessedRequests_ = 0;

        /// <summary>
        /// Locker that is used for multi-thread access.
        /// </summary>
        static readonly String lockObject_ = "locker";

        /// <summary>
        /// Settings reference.
        /// </summary>
        Settings settings_;

        /// <summary>
        /// Random generators.
        /// </summary>
        readonly Random[] workerRandoms_;

        /// <summary>
        /// Random request types.
        /// </summary>
        readonly Byte[] randomRequestTypes_;

        /// <summary>
        /// Customers.
        /// </summary>
        readonly CustomerAndAccounts[] customers_;

        /// <summary>
        /// Random with seed 0.
        /// </summary>
        readonly Random rand0_ = new Random(0);

        // Generates array of random values within ranges.
        public Int32[] GenerateRandomValuesArray(Random rand, Int32 startValue, Int32 stopValue) {

            Int32 numElems = stopValue - startValue;
            Int32[] randArray = new Int32[numElems];

            Int32 k = 0;
            for (Int32 i = startValue; i < stopValue; i++) {
                randArray[k] = i;
                k++;
            }

            // Performing permutations.
            for (Int32 i = 0; i < numElems; i++) {
                Int32 r = rand.Next(numElems);
                Int32 p = randArray[i];
                randArray[i] = randArray[r];
                randArray[r] = p;
            }

            return randArray;
        }

        public LiveRequestCreator(Settings settings) {

            settings_ = settings;

            workerRandoms_ = new Random[settings.NumWorkers];
            for (Int32 i = 0; i < settings.NumWorkers; i++) {
                workerRandoms_[i] = new Random(BitConverter.ToInt32(Settings.LocalIPAddress.GetAddressBytes(), 0));
            }

            // Calculating total number of planned requests.
            if (settings_.Inserting) {

                totalNumPlannedRequests_ = settings_.NumCustomers;

            } else {

                totalNumPlannedRequests_ =
                    settings_.NumGetCustomerAndAccounts +
                    settings_.NumGetCustomerByFullName +
                    settings_.NumGetCustomerById +
                    settings_.NumTransferMoneyBetweenTwoAccounts;
            }

            Console.WriteLine(Settings.Separator);
            Console.WriteLine(String.Format("I'm going to perform {0} requests on {1} worker(s).", totalNumPlannedRequests_, settings_.NumWorkers));

            randomRequestTypes_ = new Byte[totalNumPlannedRequests_];

            customers_ = new CustomerAndAccounts[settings_.NumCustomers];

            String dir = AppDomain.CurrentDomain.BaseDirectory;
            String[] allNames = File.ReadAllLines(Path.Combine(dir, "Names.txt"));
            String[] allSurnames = File.ReadAllLines(Path.Combine(dir, "Surnames.txt"));

            Int32[] customersAndAccountsIds = GenerateRandomValuesArray(rand0_, 0, settings_.NumCustomers * Settings.MaxAccountsPerCustomer);

            Int32 curIdIndex = 0;
            Int32 n = 0;

            // Creating each customer.
            for (Int32 i = 0; i < settings_.NumCustomers; i++) {

                // Inserting customers only if in inserting mode.
                if (settings_.Inserting) {
                    randomRequestTypes_[n] = (Byte)RequestTypes.InsertCustomers;
                    n++;
                }

                customers_[i] = new CustomerAndAccounts();
                customers_[i].CustomerId = customersAndAccountsIds[curIdIndex];
                curIdIndex++;

                customers_[i].FullName = allNames[rand0_.Next(allNames.Length)] + allSurnames[rand0_.Next(allSurnames.Length)];

                Int32 numAccounts = 1 + rand0_.Next(Settings.MaxAccountsPerCustomer);

                for (Int32 a = 0; a < numAccounts; a++) {

                    var account = customers_[i].Accounts.Add();
                    account.AccountId = customersAndAccountsIds[curIdIndex];
                    account.Balance = rand0_.Next(Settings.MinInitialBalance, Settings.MaxInitialBalance);
                    curIdIndex++;
                }
            }

            for (Int32 i = 0; i < settings_.NumGetCustomerAndAccounts; i++) {
                randomRequestTypes_[n] = (Byte)RequestTypes.GetCustomerAndAccounts;
                n++;
            }

            for (Int32 i = 0; i < settings_.NumGetCustomerAndAccounts; i++) {
                randomRequestTypes_[n] = (Byte)RequestTypes.GetCustomerAndAccounts;
                n++;
            }

            for (Int32 i = 0; i < settings_.NumGetCustomerById; i++) {
                randomRequestTypes_[n] = (Byte)RequestTypes.GetCustomerById;
                n++;
            }

            for (Int32 i = 0; i < settings_.NumGetCustomerByFullName; i++) {
                randomRequestTypes_[n] = (Byte)RequestTypes.GetCustomerByFullName;
                n++;
            }

            // Shuffling all request types.
            for (Int32 i = 0; i < totalNumPlannedRequests_; i++) {

                Int32 r = rand0_.Next(totalNumPlannedRequests_);
                Byte p = randomRequestTypes_[i];
                randomRequestTypes_[i] = randomRequestTypes_[r];
                randomRequestTypes_[r] = p;
            }
        }

        /// <summary>
        /// Incrementing total good number of responses.
        /// </summary>
        /// <param name="num"></param>
        public void IncrementTotalGoodResponses(Int32 num) {
            Interlocked.Add(ref totalGoodResponses_, num);
        }

        /// <summary>
        /// Getting number of requests.
        /// </summary>
        /// <param name="requestsToFill"></param>
        /// <param name="workerId"></param>
        /// <returns></returns>
        public Int32 GetABunchOfRequests(RequestData[] requestsToFill, Int32 workerId) {

            Int32 offset = 0, numToProcess = requestsToFill.Length;

            Random rand = workerRandoms_[workerId];

            // Calculating how much we can get.
            lock (lockObject_) {

                Int32 numLeftRequests = randomRequestTypes_.Length - numProcessedRequests_;

                if (numToProcess > numLeftRequests) {
                    numToProcess = numLeftRequests;
                }

                offset = numProcessedRequests_;
                numProcessedRequests_ += numToProcess;
            }

            // Filling the requests buffer.
            for (Int32 i = 0; i < numToProcess; i++) {

                RequestTypes rt = (RequestTypes) randomRequestTypes_[offset];
                Request r = new Request();
                CustomerAndAccounts c = customers_[rand.Next(settings_.NumCustomers)];

                switch (rt) {

                    case RequestTypes.InsertCustomers: {

                        r.Method = "POST";
                        r.Uri = "/customers/" + customers_[offset].CustomerId;
                        r.BodyBytes = customers_[offset].ToJsonUtf8();

                        break;
                    }

                    case RequestTypes.TransferMoneyBetweenTwoAccounts: {

                        CustomerAndAccounts c1 = c;
                        CustomerAndAccounts c2 = customers_[rand.Next(settings_.NumCustomers)];

                        Int32 amountToTransfer = rand.Next(1, Settings.MaxTransferAmount);

                        r.Method = "POST";
                        r.Uri = "/transfer?f=" + c1.Accounts[rand.Next(c1.Accounts.Count)].AccountId +
                            "&t=" + c2.Accounts[rand.Next(c2.Accounts.Count)].AccountId +
                            "&x=" + amountToTransfer;

                        break;
                    }

                    case RequestTypes.GetCustomerAndAccounts: {

                        r.Method = "GET";
                        r.Uri = "/dashboard/" + c.CustomerId;

                        break;
                    }

                    case RequestTypes.GetCustomerById: {

                        r.Method = "GET";
                        r.Uri = "/customers/" + c.CustomerId;

                        break;
                    }

                    case RequestTypes.GetCustomerByFullName: {

                        r.Method = "GET";
                        r.Uri = "/customers?f=" + c.FullName;

                        break;
                    }
                }

                requestsToFill[i].DataLength = r.ConstructFromFields(false, requestsToFill[i].DataBytes);

                offset++;
            }

            return numToProcess;
        }

        /// <summary>
        /// Checking if all requests and responses are processed.
        /// </summary>
        /// <returns></returns>
        public Boolean IsDone() {
            return totalGoodResponses_ == totalNumPlannedRequests_;
        }
    }

    /// <summary>
    /// File based request creator.
    /// </summary>
    class FileBasedRequestCreator : IRequestsCreator {

        /// <summary>
        /// Stream to read requests from.
        /// </summary>
        StreamReader fs_;

        /// <summary>
        /// Total number of good responses.
        /// </summary>
        Int32 totalGoodResponses_ = 0;

        /// <summary>
        /// Total number of requests.
        /// </summary>
        Int32 totalNumRequests_ = 0;

        /// <summary>
        /// Locker that is used for multi-thread access.
        /// </summary>
        static readonly String lockObject_ = "locker";

        /// <summary>
        /// Incrementing total good number of responses.
        /// </summary>
        /// <param name="num"></param>
        public void IncrementTotalGoodResponses(Int32 num) {
            Interlocked.Add(ref totalGoodResponses_, num);
        }

        /// <summary>
        /// Getting a bunch of requests.
        /// </summary>
        /// <param name="requestsToFill"></param>
        /// <param name="workerId"></param>
        /// <returns></returns>
        public Int32 GetABunchOfRequests(RequestData[] requestsToFill, Int32 workerId) {
            return ReadRequestsFromStream(requestsToFill);
        }

        /// <summary>
        /// Checking if all requests and responses are processed.
        /// </summary>
        /// <returns></returns>
        public Boolean IsDone() {
            return totalGoodResponses_ == totalNumRequests_;
        }

        /// <summary>
        /// Constructor that takes an input file.
        /// </summary>
        /// <param name="inputFilePath"></param>
        public FileBasedRequestCreator(String inputFilePath) {
            fs_ = ReadFileIntoMemoryStream(inputFilePath);
        }

        /// <summary>
        /// Splits an incoming string by white spaces respecting quotation marks.
        /// </summary>
        /// <param name="line"></param>
        /// <returns></returns>
        List<String> SmartSplitByWhiteSpace(String line) {

            List<String> parts = new List<String>();
            Boolean isInToken = false;
            Int32 lastTokenStart = 0;
            Boolean hadQuotation = false;

            // Splitting string into tokens.
            for (Int32 i = 0; i < line.Length; i++) {

                Char c = line[i];

                if (isInToken) {

                    if (hadQuotation) {
                        if (c == '"') {
                            parts.Add(line.Substring(lastTokenStart, i - lastTokenStart));
                            isInToken = false;
                            hadQuotation = false;
                        }
                    } else {
                        if (Char.IsWhiteSpace(c)) {
                            parts.Add(line.Substring(lastTokenStart, i - lastTokenStart));
                            isInToken = false;
                            hadQuotation = false;
                        }
                    }
                } else {

                    if (!Char.IsWhiteSpace(c)) {

                        isInToken = true;

                        lastTokenStart = i;

                        if (c == '"') {
                            hadQuotation = true;
                            lastTokenStart++;
                        }
                    }
                }
            }

            return parts;
        }

        /// <summary>
        /// Reading requests from stream.
        /// </summary>
        /// <param name="requestsToFill"></param>
        /// <returns></returns>
        Int32 ReadRequestsFromStream(RequestData[] reqData) {

            List<String> readLines = new List<String>();

            lock (lockObject_) {

                for (Int32 i = 0; i < reqData.Length; i++) {

                    String line = fs_.ReadLine();

                    // Checking if the end of the stream.
                    if (null == line)
                        break;

                    totalNumRequests_++;

                    readLines.Add(line);
                }
            }

            Int32 n = 0;

            foreach (String line in readLines) {

                List<String> parts = SmartSplitByWhiteSpace(line);

                Request r = new Request();

                switch (parts.Count) {

                    // GET or DELETE
                    case 2: {

                        // Checking that its only DELETE.
                        if ((parts[0] != "GET") && (parts[0] != "DELETE")) {
                            throw new ArgumentOutOfRangeException("Wrong input HTTP method (expected GET or DELETE) on line: " + line);
                        }

                        r.Method = parts[0];
                        r.Uri = parts[1];
                        r.ConstructFromFields();

                        break;
                    }

                    // POST or PUT
                    case 3: {

                        // Checking that its only POST or PUT.
                        if ((parts[0] != "PUT") && (parts[0] != "POST")) {
                            throw new ArgumentOutOfRangeException("Wrong input HTTP method (expected PUT or POST) on line: " + line);
                        }

                        r.Method = parts[0];
                        r.Uri = parts[1];
                        r.Body = parts[2];
                        r.ConstructFromFields();

                        break;
                    }

                    default: {
                        throw new ArgumentOutOfRangeException("Wrong input detected: " + line);
                    }
                }

                reqData[n].WriteData(r.CustomBytes, r.CustomBytesLength);

                n++;
            }

            return n;
        }

        /// <summary>
        /// Reading file into memory.
        /// </summary>
        /// <param name="inputFilePath"></param>
        /// <returns></returns>
        StreamReader ReadFileIntoMemoryStream(String inputFilePath) {

            MemoryStream ms = new MemoryStream();

            using (FileStream file = new FileStream(inputFilePath, FileMode.Open, FileAccess.Read)) {

                byte[] bytes = new byte[file.Length];

                file.Read(bytes, 0, (int)file.Length);

                ms.Write(bytes, 0, (int)file.Length);
            }

            ms.Seek(0, SeekOrigin.Begin);

            return new StreamReader(ms);
        }
    }

    class RetailClient {

        /// <summary>
        /// Reports performance statistics to database.
        /// </summary>
        static void ReportPerformanceStats(
            WorkerSettings[] workerSettings,
            Node nodeClient,
            Stopwatch timer) {

            // Sending last statistics information.
            Int32 numGoodResponses = 0;
            for (Int32 i = 0; i < workerSettings.Length; i++) {
                numGoodResponses += workerSettings[i].NumGoodResponses;
            }

            // Creating stats URL.
            String statsUri = String.Format("/addstats/{0}/{1}/{2}",
                Settings.LocalIPAddress.ToString(),
                numGoodResponses,
                (Int32) (numGoodResponses * 1000.0 / timer.ElapsedMilliseconds));

            Response resp = nodeClient.POST(statsUri, "NoBody", null);

            if (!resp.IsSuccessStatusCode) {
                throw new Exception("Can't update test statistics: " + resp.Body);
            }
        }

        // Pre-loading Starcounter dependencies.
        static Int32 ScPreloadError = StarcounterResolver.LoadDependencies();

        static Int32 Main(string[] args) {

            try {

                // Parsing command line settings.
                Settings settings = new Settings();
                settings.Init(args);

                WorkerSettings[] workerSettings = new WorkerSettings[settings.NumWorkers];
                CountdownEvent waitForAllWorkersEvent = new CountdownEvent(settings.NumWorkers);

                Node nodeClient = new Node(settings.ServerIp, settings.ServerPort);
                Response nodeResp;

                for (Int32 i = 0; i < settings.NumWorkers; i++) {

                    workerSettings[i] = new WorkerSettings() {
                        NumBodyCharacters = 8,
                        WaitForAllWorkersEvent = waitForAllWorkersEvent,
                        NumGoodResponses = 0,
                        WorkersRPS = 0,
                        ExitCode = 0
                    };
                }

                Stopwatch timer = new Stopwatch();
                timer.Restart();

                Boolean useRequestsFile = false;
                IRequestsCreator irc = null;

                // Checking if we should use requests file.
                if (!useRequestsFile) {

                    LiveRequestCreator rc = null;

                    switch (settings.TestType) {

                        case TestTypes.PokerDemo: {

                            rc = new LiveRequestCreator(settings);

                            break;
                        }

                        case TestTypes.Echo:
                        case TestTypes.Gateway:
                        case TestTypes.GatewayNoIPC:
                        case TestTypes.GatewayAndIPC:
                        case TestTypes.GatewayNoIPCNoChunks: {

                            rc = new LiveRequestCreator(settings);
                            //rc = new RequestsCreator(null, 0, 1, 1, 1, 1, 1, 1);
                            //rc.SetTotalPlannedRequests(settings.NumTestRequestsEachWorker * settings.NumWorkers);

                            break;
                        }
                    }

                    irc = rc;

                } else {
                    
                    FileBasedRequestCreator grc = new FileBasedRequestCreator(@"c:\github\PokerDemo\PokerDemoConsole\bin\Debug\requests.txt");

                    irc = grc;
                }

                timer.Stop();

                Console.WriteLine(Settings.Separator);
                Console.WriteLine("Preparing requests took ms: " + timer.ElapsedMilliseconds);

                // Cleaning database when inserting.
                if (settings.Inserting) {

                    timer.Restart();
                    nodeResp = nodeClient.GET("/init");
                    timer.Stop();

                    if (!nodeResp.IsSuccessStatusCode) {
                        throw new Exception("Can't re-initialize the database: " + nodeResp.Body);
                    }

                    Console.WriteLine(Settings.Separator);
                    Console.WriteLine("Re-initialize the database took ms: " + timer.ElapsedMilliseconds);
                }

                Console.WriteLine(Settings.Separator);

                // Restarting measuring.
                timer.Restart();

                for (Int32 i = 0; i < settings.NumWorkers; i++) {
                    Int32 workerId = i;
                    Worker worker = new Worker(workerId, workerSettings[workerId], settings);
                    ThreadStart threadDelegate = new ThreadStart(() => worker.WorkerRoutine(irc));
                    Thread newThread = new Thread(threadDelegate);
                    newThread.Start();
                }

                Int32 maxWorkerTimeSeconds = 100;
                Int32 numSecondsLastStat = Settings.SendStatsNumSeconds;

                // Looping until worker finish events are set.
                while (waitForAllWorkersEvent.CurrentCount > 0) {

                    lock (settings) {
                        for (Int32 i = 0; i < settings.NumWorkers; i++) {
                            Console.WriteLine(String.Format("[{0}] number of good responses: {1}", i, workerSettings[i].NumGoodResponses));
                        }
                    }

                    Thread.Sleep(1000);
                    numSecondsLastStat--;

                    // Checking if its time to report statistics.
                    if (numSecondsLastStat == 0) {

                        numSecondsLastStat = Settings.SendStatsNumSeconds;

                        // Doing REST call to send statistics to server.
                        ReportPerformanceStats(workerSettings, nodeClient, timer);
                    }

                    maxWorkerTimeSeconds--;
                    if (0 == maxWorkerTimeSeconds) {
                        throw new TimeoutException("One of workers timed out!");
                    }
                }

                waitForAllWorkersEvent.Wait();
                timer.Stop();

                // Checking if every worker succeeded.
                for (Int32 i = 0; i < settings.NumWorkers; i++) {
                    if (workerSettings[i].ExitCode != 0) {
                        return workerSettings[i].ExitCode;
                    }
                }

                Int32 totalRPS = 0;
                for (Int32 i = 0; i < settings.NumWorkers; i++) {
                    totalRPS += workerSettings[i].WorkersRPS;
                }

                // Doing REST call to send statistics to server.
                ReportPerformanceStats(workerSettings, nodeClient, timer);

                Console.WriteLine(String.Format("SUMMARY: Total workers RPS is {0}, total time {1} ms.", totalRPS, timer.ElapsedMilliseconds));

                return 0;

            } catch (Exception exc) {

                Console.WriteLine(exc.ToString());

                return 1;
            }
        }
    }
}
