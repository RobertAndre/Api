const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Client } = require('square');
const { randomUUID } = require('crypto');
const { ThirdwebSDK } = require('@thirdweb-dev/sdk');

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

const corsOptions = {
    origin: (origin, callback) => {
        if (whitelist.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Sorry but you have no business being Here'));
        }
    },
};
app.use(cors(corsOptions));
// Define your routes and API endpoints here

// Start the server
const port = 3000; // Choose a port number
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});


app.post('/api/claims', authenticateToken,  async (req, res) => {
    // Handle the incoming POST request here
    // Access the request body using req.body
    const body = req.body;
    const sourceId = body.sourceId;
    const amount = body.orderTotal;
    const contract = body.contract;
    const claimData = body.claimData;
    const receiver = body.receiver;
    const pricePerToken = body.pricePerToken;
    const allowlistProof = body.allowlistProof;
    const requestId = randomUUID();

    const options = {
        idempotencyKey: requestId,
        sourceId: sourceId,
        amountMoney: {
          currency: 'USD',
          amount: amount,
        },
      };
    // Do something with the signal data
    const { paymentsApi } = new Client({
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
        environment: process.env.SQUARE_ENVIRONMENT,
      });

      const sdk = ThirdwebSDK.fromPrivateKey(process.env.TWSDK_PRIVATE_KEY, process.env.NFT_NETWORK);
      const nftCollection = await sdk.getContract(contract, 'edition');

      try {

        const resp = await paymentsApi.createPayment(options);
        
        if (resp.status === 200) {
            const { result } = await resp.json();
            console.log(result);
            // return result;
            const data = await nftCollection.call("claimBatchTo", receiver, claimData, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", pricePerToken, allowlistProof)
            // return data;
            // Send a response
            res.send(JSON.stringify(data));
        }
        // set up 
    } catch (e) {
        console.log("Problems Processing Payment", e);
        res.send("Problems Processing Payment", e);
    }

    
});


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.BEARER_TOKEN, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
}