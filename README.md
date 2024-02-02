# sneiper
Snipe NFTs on SEI.

# Features
1. Target a Collection on Pallet and buy specific multiple NFTs that fall under a certain price point
2. Target a Collection on Pallet and buy any multiple NFTs that fall under a certain price point
3. Target a Lighthouse Mint site and mint NFTs. 

# Installation
1. Install node js, npm and git
2. Clone this repo with git, in terminal run:
   ```bash
   git clone https://github.com/fudgebucket27/sneiper
   ```
3. Navigate to the sneiper directory, in terminal run:
   ```bash
   cd sneiper
   ```
4. Install dependencies, in terminal run:
   ```bash
   npm install
   ```
5. In the sneiper folder, create a ".env" file with the following settings. [An example file is include here.](https://github.com/fudgebucket27/sneiper/blob/main/.env.example)
   ```text
   RECOVERY_PHRASE=       your recovery phrase, use a burner
   RPC_URL=               the SEI rpc url
   MODE=                  set to BUY to snipe on pallet. set to MINT to snipe lighthouse mints.
   MINT_URL=              if using MINT mode, the url of the lighthouse mint site, eg https://www.seitarded.xyz 
   MINT_LIMIT_PER_PHASE=  if using MINT mode, the amount of NFTs to mint per phase, eg 2
   MINT_LIMIT_TOTAL=      if using MINT mode, the total amount of NFTs to mint overall across all phases,eg 4 
   CONTRACT_ADDRESS=      if using BUY mode, the contract address for the collection on pallet, eg sei1e7mv93mrw629r66ykqc92gllls3dmsuytvetxzxpq8e5x6j3nj2qqjtxlr
   TOKEN_ID=              if using BUY mode, the token id for the NFT, you can add multiple token ids, just seperate them with a comma, or use SWEEP to search the first 25 NFTs in the collection that fall under the PRICE_LIMIT. or use AUTO to keep buying 1 NFT at a time under the PRICE_LIMIT until the BUY_LIMIT is reached. 
   BUY_LIMIT=             if using SWEEP in TOKEN_ID, this is the amount of NFTs to buy in a sweep in one transaction; limited to 25 max. if using AUTO this is the max amount of NFTs to buy in total.
   PRICE_LIMIT=           if using BUY mode, it is the price limit to buy at for the NFT, eg 0.3
   GAS_LIMIT=             the gas limit, eg 0.1
   POLLING_FREQUENCY=     in seconds, how often to check pallet or the mint ui site for listings/contract changes
   ```
   
6. To run sneiper, in terminal run:
   ```bash
   npm start run
   ```
   
# Contributing
Pull requests are welcome! 

# TO DO
1. Support for dagora
