const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Client } = require('square');
const { randomUUID } = require('crypto');
const { ThirdwebSDK } = require('@thirdweb-dev/sdk');

BigInt.prototype.toJSON = function () {
    return this.toString();
  };

// Create an Express server
const app = express();

// Use body-parser middleware to parse request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure CORS to allow requests only from whitelisted domains
const whitelist = [process.env.ALLOWDEV,
process.env.ALLOWNFT,
process.env.ALLOWSTORE
]; // Add your whitelisted domains here

// const corsOptions = {
//     origin: (origin, callback) => {
//         if (whitelist.includes(origin)) {
//             callback(null, true);
//         } else {
//             callback(new Error('Sorry but you have no business being Here'));
//         }
//     },
// };

// app.use(cors(corsOptions));
// Define your routes and API endpoints here

// Start the server
const port = process.env.PORT || 3001; // Choose a port number
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});



app.post('/api/claims', authenticateToken, async (req, res) => {
    // Handle the incoming POST request here
    // Access the request body using req.body
    if (req.method !== "POST") {
        return res.status(400).json({
            error: "Nice Try but It's time for you to leave.",
        });
    }

    const body = req.body;
    const sourceId = body.sourceId;
    const amount = body.orderTotal;
    const contract = body.contract;
    const claimData = body.claimData;
    const receiver = body.receiver;
    const pricePerToken = body.pricePerToken;
    const allowlistProof = body.allowlistProof;
    const shippingAddress = body.shippingAddress;
    const email = body.buyerEmailAddress;
    const note = body.note;
    const requestId = randomUUID();

    const options = {
        idempotencyKey: requestId,
        sourceId: sourceId,
        amountMoney: {
            currency: 'USD',
            amount: amount,
        },
        autocomplete: false,
        note: note,
        buyerEmailAddress: email,
        shippingAddress: shippingAddress
    };

    console.log(JSON.stringify(options));

    // Set up the Square Payment API 
    const { paymentsApi } = new Client({
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
        environment: process.env.SQUARE_ENVIRONMENT,
    });

    // set up payment variables
    let payment_id;
    let version_token;
   
    if(amount === 0){
        try {
            // Time to Claim the NFTS & Prints
            const sdk = ThirdwebSDK.fromPrivateKey(process.env.TWSDK_PRIVATE_KEY, process.env.NFT_NETWORK);
            const nftCollection = await sdk.getContract(contract, 'edition');
            const data = await nftCollection.call("claimBatchTo",
                receiver,
                claimData,
                "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                pricePerToken,
                allowlistProof
            );
            console.log("Print Claimed :(", JSON.stringify(data));
            res.send(JSON.stringify(data));
                
        } catch (e) {  // Claiming Failed cancel the playment
            console.log("Print already Claimed :(", e);
            // res.send("Print Claiming failed :(", e);
            res.send(e)
        }

    }else{

  


        try {
            // create a delayed Capture of a Card Payment
            const { result } = await paymentsApi.createPayment(options);
            console.log(result);

            // If successful save the result for later
                // const paymentResult = await resp.json();
                const paymentResult =  result;
                console.log(paymentResult);
                payment_id = paymentResult.payment.id;
                version_token = paymentResult.payment.version_token;
           
            // set up 
        } catch (e) {
            console.log("Problems Processing Payment", e);
            res.send(e)
            // res.send("Problems Processing Payment", e);
        
        }


        try {
            // Time to Claim the NFTS & Prints
            const sdk = ThirdwebSDK.fromPrivateKey(process.env.TWSDK_PRIVATE_KEY, process.env.NFT_NETWORK);
            const nftCollection = await sdk.getContract(contract);
            const data = await nftCollection.call("claimBatchTo",
                receiver,
                claimData,
                "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                pricePerToken,
                allowlistProof
            );
            console.log("Print Claimed :(", JSON.stringify(data));

                
        } catch (e) {  // Claiming Failed cancel the playment
            console.log("payment_id", payment_id);
            try {
                const response = await paymentsApi.cancelPayment(payment_id);
                console.log(response.result);
                console.log("Print already Claimed :(, Cancel Complete", e);
                res.send(e)
                // res.send("Print already Claimed :(", e);
            } catch (error) {
                console.log(error);
                console.log("Print already Claimed :(, and payment cancel failed", e);
                res.send(e)
                // res.send("Print already Claimed :(", error);
            }

        }

        // Complete the transcaction.
        try {
            const paymentComplete = await paymentsApi.completePayment(payment_id, { versionToken: version_token });
            console.log(paymentComplete.result);
            res.send(JSON.stringify(paymentComplete));
            // res.send("Error Finalizing the Payment", error);
        } catch (error) {
            console.log("Error Finalizing the Payment", error);
            res.send(error);
            // res.send("Error Finalizing the Payment", error);
        }
    }

});


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.sendStatus(401);
    }
    let secret =  (typeof process.env.BEARER_TOKEN === 'string') || (process.env.BEARER_TOKEN instanceof String) ? process.env.BEARER_TOKEN : process.env.BEARER_TOKEN.toString();
    console.log("token", token)
    if(token === secret){
        console.log("match")
        next();
    }else{
        return res.sendStatus(403);
    }
    // jwt.verify(token, secret, (err, user) => {
    //     if (err) {
    //         return res.sendStatus(403);
    //     }
    //     req.user = user;
    //     next();
    // });
}