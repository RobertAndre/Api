const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Client } = require('square');
const { randomUUID } = require('crypto');
const { ThirdwebSDK } = require('@thirdweb-dev/sdk');
const { Ethers } = require('ethers')

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

function reformatCartItems(nft) {
    return {
        "tokenId": nft.tokenId.toString(),
        "claimingType": nft.claimingType.toString(),
        "startRange": "0",
        "endRange": "0",
        "printDataBasic": {
            "productId": nft.printDataBasic.productId.toString(),
            "quantity": nft.printDataBasic.quantity.toString()
        }
    }
}

app.post('/api/wakeup', authenticateToken, async (req, res) => {
    if (req.method !== "POST") {
        return res.status(400).json({
            error: "Nice Try but It's time for you to leave.",
        });
    }
    const response = {
        "status": "success",
        "response": "awake"
    }
    res.end(JSON.stringify(response));
});

app.post('/api/discount', authenticateToken, async (req, res) => {
    if (req.method !== "POST") {
        return res.status(400).json({
            error: "Nice Try but It's time for you to leave.",
        });
    }
    const address = body.address;
    const contractAddress = process.env.contractAddress;
    
    const readOnlySdk = new ThirdwebSDK(process.env.NFT_NETWORK, {
        secretKey:  process.env.TW_SECRETE_KEY, // Use secret key if using on the server, get it from dashboard settings
      }); 

    const nftCollection = await readOnlySdk.getContract(contractAddress, "nft-drop");
    const claimerProofs = await nftCollection.erc721.claimConditions.getClaimerProofs(address,);

    let allowlistProof;
    let numClaimedForFree;
    
    if(typeof claimerProofs !== 'undefined' && claimerProofs !== null){
        // const numberOfNfts = await nftDrop.call("balanceOf", [address]);
        numClaimedForFree = await nftDrop.call("numClaimedForFree", [address]);
        const maxClaims = Number.parseInt(claimerProofs?.maxClaimable);
        const ppToken  =  Number.parseInt(claimerProofs?.price);
        const maxClaim = Ethers.utils.hexValue(maxClaims);
        const ppT      = Ethers.utils.hexValue(ppToken);

        allowlistProof = {
            proof: claimerData?.proof,
            quantityLimitPerWallet: { "type": "BigNumber", "hex": maxClaim },
            pricePerToken: { "type": "BigNumber", "hex": ppT },
            currency: claimerProofs?.currencyAddress.toString(),
            numClaimedForFree: numClaimedForFree,
            maxDiscountNumber: claimerProofs?.maxClaimable,
          };


    }else{

        allowlistProof =  {
            proof: [ "0x0000000000000000000000000000000000000000000000000000000000000000"],
            quantityLimitPerWallet: { "type": "BigNumber", "hex": "0x0" },
            pricePerToken: { "type": "BigNumber", "hex": "0x0" },
            currency: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            numClaimedForFree: 0,
            maxDiscountNumber: 0,
          }

    }
   
    res.end(JSON.stringify(allowlistProof));
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
    const numberDiscounted = body.numberDiscounted;
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

    // console.log(JSON.stringify(options));
    const newUnclaimed = claimData.map(nft => reformatCartItems(nft));

    // Set up the Square Payment API 
    const { paymentsApi } = new Client({
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
        environment: process.env.SQUARE_ENVIRONMENT,
    });

    // set up payment variables
    let payment_id;
    let version_token;
    let claimSuccess = false;
    if(amount === 0){
        try {
            // Time to Claim the NFTS & Prints
            const sdk = ThirdwebSDK.fromPrivateKey(process.env.TWSDK_PRIVATE_KEY, process.env.NFT_NETWORK,  
                {
                secretKey:  process.env.TW_SECRETE_KEY, // Use secret key if using on the server, get it from dashboard settings
              });
            const nftCollection = await sdk.getContract(contract, "nft-drop");

            const data = await nftCollection.call("claimBatchTo", 
                [receiver,
                newUnclaimed,
                "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                pricePerToken,
                numberDiscounted,
                allowlistProof]
            );
            console.log("Print Claimed");

            const response = {
                "status": "success",
                "location": "completePayment",
                "response": data
            }
            res.end(JSON.stringify(response));
                
            if(data?.receipt.status === 1){
                claimSuccess = true;
            }else{
                try {
                    const { result } = await paymentsApi.cancelPayment(payment_id);
                   
                    console.log("ERROR: Cancel Complete: ", "Problem Processing the print");
                  
                    const response = {
                        "status": "error",
                        "location": "claiming",
                        "error": "Problem Processing the print"
                    }
                    res.end(JSON.stringify(response));
    
    
                 
                } catch (error) {
                    console.log(error);
                    console.log("ERROR: Cancel Error", error);
                    const response = {
                        "status": "error",
                        "location": "cancelPayment",
                        "error": "Problem Processing the print",
                        "cancelError": error
                    }
                    res.end(JSON.stringify(response));
                }

            }


        } catch (e) {  // Claiming Failed cancel the playment
            console.log("ERROR: Print already Claimed :(", e);
            // res.send("Print Claiming failed :(", e);
            const response = {
                "status": "error",
                "location": "claiming",
                "error": e
            }
            res.end(JSON.stringify(response));
        }

    }else{

  


        try {
            // create a delayed Capture of a Card Payment
            const { result } = await paymentsApi.createPayment(options);
            // console.log(result);

            // If successful save the result for later
                // const paymentResult = await resp.json();
                const paymentResult = result;
                payment_id = paymentResult.payment.id;
                version_token = paymentResult.payment.version_token;
           
            // set up 
        } catch (e) {
            console.log("ERROR: Problems Processing Payment", e);
            res.end(JSON.stringify(e))
            // res.send("Problems Processing Payment", e);
        
        }
       
        try {
            // Time to Claim the NFTS & Prints
            const sdk = ThirdwebSDK.fromPrivateKey(process.env.TWSDK_PRIVATE_KEY, process.env.NFT_NETWORK,  {
                // clientId: process.env.TW_CLIENT_ID, // Use client id if using on the client side, get it from dashboard settings
                secretKey:  process.env.TW_SECRETE_KEY, // Use secret key if using on the server, get it from dashboard settings
              }
            //     , 
            //     {
            //     gasless: {
            //       // By specifying a gasless configuration - all transactions will get forwarded to enable gasless transactions
            //       openzeppelin: {
            //         relayerUrl: process.env.OPENZEPPELIN_URL,
            //       }
            //     },
            //   }
              );
            const nftCollection = await sdk.getContract(contract, "nft-drop");

            console.log("receiver:", receiver );
            console.log("claimData:", newUnclaimed );
            console.log("pricePerToken:", pricePerToken);
            console.log("allowlistProof:", allowlistProof );
        
            const data = await nftCollection.call("claimBatchTo", [receiver,  
                                                                newUnclaimed, 
                                                                "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                                                                pricePerToken,
                                                                numberDiscounted,
                                                                allowlistProof]);
            console.log("Print Claimed :(", JSON.stringify(data));
            if(data?.receipt.status === 1){
                claimSuccess = true;
            }else{
                try {
                    const { result } = await paymentsApi.cancelPayment(payment_id);
                   
                    console.log("ERROR: Cancel Complete: ", "Problem Processing the print");
                  
                    const response = {
                        "status": "error",
                        "location": "claiming",
                        "error": "Problem Processing the print"
                    }
                    res.end(JSON.stringify(response));
    
    
                 
                } catch (error) {
                    console.log(error);
                    console.log("ERROR: Cancel Error", error);
                    const response = {
                        "status": "error",
                        "location": "cancelPayment",
                        "error": e,
                        "cancelError": error
                    }
                    res.end(JSON.stringify(response));
                }

            }

            
                
        } catch (e) {  // Claiming Failed cancel the playment
      
            try {
                const { result } = await paymentsApi.cancelPayment(payment_id);
               
                console.log("ERROR: Cancel Complete", JSON.stringify(e));
              
                const response = {
                    "status": "error",
                    "location": "claiming",
                    "error": e
                }
                res.end(JSON.stringify(response));


             
            } catch (error) {
                console.log(error);
                console.log("ERROR: Cancel Error", error);
                const response = {
                    "status": "error",
                    "location": "cancelPayment",
                    "error": e,
                    "cancelError": error
                }
                res.end(JSON.stringify(response));
            }

        }

        // Complete the transcaction.
        if(claimSuccess){
            try {
                const { result } = await paymentsApi.completePayment(payment_id, { versionToken: version_token });
                console.log("completePayment:", result);

                const response = {
                    "status": "success",
                    "location": "completePayment",
                    "response": result
                }
                res.end(JSON.stringify(response));

            } catch (error) {
                console.log("ERROR:Error Finalizing the Payment", error);

                const response = {
                    "status": "error",
                    "location": "completePayment",
                    "error": error
                }
                res.end(JSON.stringify(response));

            }
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
  
    if(token === secret){

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