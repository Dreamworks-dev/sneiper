import { getMintDetailsFromUrl, getCollectionConfig, getHashedAddress, getFormattedTimestamp, logMessage} from './helpers.js';
import { generateMerkleProof, generateMerkleRoot, isMatchingMerkle } from './merkle.js';
import { isProcessingMintQueue, executionQueue, updateProcessingMintQueueStatus, mintedTokens, addMintedTokenSuccess, removeWallet} from './config.js';

const lightHouseContractAddress = "sei1hjsqrfdg2hvwl3gacg4fkznurf36usrv7rkzkyh29wz3guuzeh0snslz7d";
const frankenFrensFeeAddress = "sei1t403lg45sl5n02jlah7zjaw2rdtuayh4nfh352";
const frankenFrensFeeAmount = "100000"; //0.1 SEI per successful mint
const mintLimitTotal = parseInt(process.env.MINT_LIMIT_TOTAL, 10);
const walletMintCounts = {};


export async function mintSneiper(senderAddress, needsToPayFee, signingCosmWasmClient) {

    try {
      if(!isProcessingMintQueue[senderAddress]){
        if(mintedTokens.length >= process.env.MINT_LIMIT_TOTAL)
        {
          logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint limit total reached! Exiting`)
          removeWallet(senderAddress);
          return;
        }
        if(walletMintCounts[senderAddress] >= process.env.MINT_LIMIT_PER_WALLET) {
          logMessage(`${senderAddress},${getFormattedTimestamp()}:Skipping mint for ${senderAddress} as mint limit per wallet/total has been reached.`);
          removeWallet(senderAddress);
          return;
        }
        const current_time = Math.floor(Date.now() / 1000);
        updateProcessingMintQueueStatus(true, senderAddress);
        logMessage(`${senderAddress},${getFormattedTimestamp()}:Retrieving mint details from ${process.env.MINT_URL}`)
        const mintDetails = await getMintDetailsFromUrl(process.env.MINT_URL);
        if(mintDetails){
            let collectionConfig = null;
            let contractAddress = findContractAddress(mintDetails);
            logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint details found..\nContract Address: ${contractAddress}`);
            logMessage(`${senderAddress},${getFormattedTimestamp()}:Getting collection config...`);
            collectionConfig = await getCollectionConfig(contractAddress, signingCosmWasmClient);
            let hashedAddress = null;
            if(collectionConfig){
              logMessage(`${senderAddress},${getFormattedTimestamp()}:Collection config found...`);
              const allowlistDetails = findAllowlistDetails(mintDetails);
                //Handle Allow list first
                for (const allowlistDetail of allowlistDetails) {
                  if(allowlistDetail.allowlist == null || allowlistDetail.allowlist.length === 0)
                  {
                    continue;
                  }
                  const senderMerkleRoot = generateMerkleRoot(allowlistDetail.allowlist, senderAddress);
                  if (!senderMerkleRoot) {
                      logMessage(`${senderAddress},${getFormattedTimestamp()}:Your address ${senderAddress} is not in the allowlist: ${allowlistDetail.name}`);
                      continue; 
                  }

                  const group = collectionConfig.mint_groups.find(g => g.merkle_root && isMatchingMerkle(senderMerkleRoot, g.merkle_root));
                  
                  if (group) {
                      logMessage(`${senderAddress},${getFormattedTimestamp()}:Matching mint group found for allowlist: ${allowlistDetail.name}`);
                      const isMintPhaseCurrent = current_time >= group.start_time && (group.end_time === 0 || current_time <= group.end_time);
                      
                      if (isMintPhaseCurrent) {
                          logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint phase current for group: ${group.name}!`);
                          const merkleProof = generateMerkleProof(allowlistDetail.allowlist, senderAddress);
                          executionQueue.push({
                              senderAddress, 
                              hashedAddress: getHashedAddress(senderAddress), 
                              merkleProof, 
                              contractAddress, 
                              groupName: group.name, 
                              unitPrice: group.unit_price, 
                              needsToPayFee, 
                              signingCosmWasmClient
                          });
                          await processQueue();
                      } else {
                          logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint phase not current for group: ${group.name}!`);
                      }
                  } else {
                      logMessage(`${senderAddress},${getFormattedTimestamp()}:No matching mint group found for allowlist with generated Merkle root.`);
                  }
                }

                //Handle public
                for (const group of collectionConfig.mint_groups) {
                  if (group.merkle_root == null) {
                      const isMintPhaseCurrent = current_time >= group.start_time && (group.end_time === 0 || current_time <= group.end_time);
                      if (isMintPhaseCurrent) {
                          logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint phase current for group: ${group.name}`);
                          executionQueue.push({
                              senderAddress, 
                              hashedAddress: null, 
                              merkleProof: null, 
                              contractAddress, 
                              groupName: group.name, 
                              unitPrice: group.unit_price, 
                              needsToPayFee, 
                              signingCosmWasmClient
                          });
                          await processQueue();
                      } else {
                          logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint phase not current for group: ${group.name}`);
                      }
                      continue;
                  }
              }
              updateProcessingMintQueueStatus(false, senderAddress);
            }
            else{
              updateProcessingMintQueueStatus(false, senderAddress);
                logMessage(`${senderAddress},${getFormattedTimestamp()}:Collection config not found...`);
                removeWallet(senderAddress);
                return;
              }
        }else{
            updateProcessingMintQueueStatus(false, senderAddress);
            logMessage(`${senderAddress},${getFormattedTimestamp()}:Mint details not found...is this a lighthouse mint site?`);
            removeWallet(senderAddress);
            return;
          }
      }
    } catch (error){
        logMessage(`${senderAddress},${getFormattedTimestamp()}:Sneipe unsuccessful! ` + error.message);
    }
}

export async function processQueue() {
  if (executionQueue.length === 0) {
      return;
  }

  const {senderAddress, hashedAddress, merkleProof, contractAddress, groupName, unitPrice, needsToPayFee, signingCosmWasmClient} = executionQueue.shift();
  updateProcessingMintQueueStatus(true, senderAddress);

  try{
    logMessage(`${senderAddress},${getFormattedTimestamp()}:Sneiping...`);
    await executeContract(senderAddress, hashedAddress, merkleProof, contractAddress, groupName, unitPrice, needsToPayFee, signingCosmWasmClient);
  } catch (error) {
    logMessage(`${senderAddress},${getFormattedTimestamp()}:Sneipe unsuccessful! ` + error.message);
  } finally {

  }
  updateProcessingMintQueueStatus(false, senderAddress);
}

export async function executeContract(senderAddress, hashedAddress, merkleProof, contractAddress, groupName, unitPrice, needsToPayFee, signingCosmWasmClient) {
    try {
      const instruction = {
        contractAddress: lightHouseContractAddress,
        msg: {
            mint_native: {
                collection: contractAddress,
                group: groupName,
                recipient: senderAddress,
                merkle_proof: merkleProof,
                hashed_address: hashedAddress
            }
        }
      };

        const unitPriceNumber = parseFloat(unitPrice);
        const lighthouseFeeNumber = unitPrice == "0" ? parseFloat("0") : parseFloat("1500000"); //if unit price is 0, no light house fee
        const finalAmountWithLighthouseFee = unitPriceNumber + lighthouseFeeNumber; //Add 1.5 SEI for Lighthouse fee
  
        const totalFunds = [{
          denom: 'usei',
          amount: finalAmountWithLighthouseFee.toString()
        }];

        if(unitPrice != "0")
        {
          instruction.funds = totalFunds;
        }
        let instructions = [];

        for(let i = 0; i < process.env.MINT_LIMIT_PER_PHASE; i++)
        {
          instructions.push(instruction);
        }

        const result = await signingCosmWasmClient.executeMultiple(senderAddress, instructions, "auto")

        let currentMintCount = 0;
        const logs = result.logs
        for (const log of logs) {
            const events = log.events
            for (const event of events) {
                if (event.type === 'wasm') {
                    for (const attribute of event.attributes) {
                        if (attribute.key === 'token_id') {
                            addMintedTokenSuccess(attribute.value);
                            currentMintCount++;
                            break;
                        }
                    }
                }
            }
        }
        
        if(mintedTokens.length > 0){
          logMessage(`${senderAddress},${getFormattedTimestamp()}:Sneipe successful for ${currentMintCount} NFTs...Tx hash: ${result.transactionHash}`);
          walletMintCounts[senderAddress] = (walletMintCounts[senderAddress] || 0) + 1;
          if(needsToPayFee){
            try {
              const finalFrankenFrensFeeAmount = parseFloat(frankenFrensFeeAmount) * currentMintCount;
              const convertedFeeAmount = (finalFrankenFrensFeeAmount / 1000000).toString();
              logMessage(`${senderAddress},${getFormattedTimestamp()}:You do not hold enough FrankenFrens...A fee of ${convertedFeeAmount} SEI is being sent as there were ${currentMintCount} succesful mints...`)
              const feeFunds = [{
                denom: 'usei',
                amount: finalFrankenFrensFeeAmount.toString()
              }];
              const feeResult = await signingCosmWasmClient.sendTokens(senderAddress, frankenFrensFeeAddress, feeFunds, "auto", "fee for FrankenFrens mint sniper");
              if(feeResult.transactionHash){
                logMessage(`${senderAddress},${getFormattedTimestamp()}:FrankenFrens fee sent. Thank you.`)
              }
              else{
                logMessage(`${senderAddress},${getFormattedTimestamp()}:FrankenFrens fee not sent due to an issue. You have not been charged.`)
              }
            }catch (error){
              logMessage(`${senderAddress},${getFormattedTimestamp()}:FrankenFrens fee transfer unsuccesful: " + ${error.message} + ". You have not been charged.`);
            }finally {
           
            }
          }
        }else {
          logMessage(`${senderAddress},${getFormattedTimestamp()}:Sneipe unsuccessful!`)
        }
      } catch (error) {
        logMessage(`${senderAddress},${getFormattedTimestamp()}:Sneipe unsuccessful! ` + error.message);

        if(error.message.toUpperCase().includes("MAX TOKENS MINTED"))
        {
          logMessage(`${senderAddress},${getFormattedTimestamp()}:Max tokens minted for wallet. Exiting...`);
          removeWallet(senderAddress);
          return;
        }

        if(error.message.toUpperCase().includes("SOLD OUT"))
        {
          logMessage(`${senderAddress},${getFormattedTimestamp()}:Collection SOLD OUT. Exiting...`);
          removeWallet(senderAddress);
          return;
        }
      } finally {

      }

      if (mintedTokens.length >=  mintLimitTotal) {
        logMessage(`${senderAddress},${getFormattedTimestamp()}:All tokens have been successfully bought. Exiting...`);
        removeWallet(senderAddress);
        return;
      }
}

function findContractAddress(mintDetails)
{
  for (let prop in mintDetails) {
    if (mintDetails.hasOwnProperty(prop) && isValidContractAddress(mintDetails[prop])) {
        let contractAddress = mintDetails[prop];
        return contractAddress;
    }
  }
}

function isValidContractAddress(address) {
  return /^sei1[a-zA-Z0-9]{58}$/.test(address);
}

function findAllowlistDetails(mintDetails) {
  for (let prop in mintDetails) {
      if (mintDetails.hasOwnProperty(prop)) {
          const potentialAllowlist = mintDetails[prop];
          if (Array.isArray(potentialAllowlist) && isValidAllowlist(potentialAllowlist)) {
              return potentialAllowlist;
          }
      }
  }
  return null;
}

function isValidAllowlist(allowlist) {
  return allowlist.length > 0;
}