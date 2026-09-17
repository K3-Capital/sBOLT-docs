# Price Oracle

### **Registry**

The sBold’s price oracle configurations are settled in the so-called Registry contract, which is the main source of truth for quote segregation. Each price Oracle contract should comply with the IPriceOracle interface to be onboarded in the registry. The presented function interfaces in the IPriceOracle are the getQuote(uint256 inAmount, address base) and isBaseSupported(address base).

The registry contract itself complies with the IPriceOracle interface and proxies static calls to the onboarded adapters. Each quote is returned in denomination to USD and is scaled to an amount with a precision of 18 to keep the homogenous behavior of the system.

A registry contract instance is managed by an admin, who configures the respective price oracles through the setOracles(Oracle\[] memory oracles) functionality. In the current implementation, the base asset to adapter relation is 1:1, meaning a base asset can be attached to one adapter.

### **ChainlinkOracle**

The base in the context system Chainlink Oracle adapter represents a contract that inherits the IPriceOracle and is responsible for obtaining the price for a base asset from a feed in which the quote asset is only USD. The adapter scales the result to decimals precision of 18, based on the feed’s decimals. On getting a quote, checks for the price validity and staleness are performed.

### **ChainlinkLstOracle**

The Chainlink LST (liquid-staking token) oracle adapter shares the same IPriceOracle interface and is responsible for obtaining the price for an LST to ETH quote asset and the price for ETH to USD quote asset.

The ChainlinkLstOracle contract provides a straightforward way to derive LST/USD price by combining:

1. A Chainlink feed reporting the current *ETH / USD* price
2. A Chainlink feed reporting the current *LST / ETH* price

The adapter scales the result to decimal precision of 18 and returns a quote for the LST to USD. The performed checks are the same as in the standard ChainlinkOracle adapter.

The oracle adapter is used for the rETH/USD price derivation.

#### **WstEthOracle**

The WstEthOracle oracle adapter shares the same IPriceOracle and serves for the derivation of the WstEth/USD price by combining:

1. A Chainlink feed reporting the current *STETH / USD* price
2. The canonical conversion rate from *WstETH* to *STETH* (via the StETH contract)

Under the hood, it inherits from BaseChainlinkOracle, which handles common tasks such as fetching and validating raw Chainlink answers. The WstEthOracle layer takes the latest STETH / USD value (normalized to 18 decimals), multiplies it by how much ETH each WstETH share represents (also 18 decimals), and then rescales the product to 18 decimals again. If any step returns zero or a stale/invalid price, the oracle will revert.

The oracle adapter is used for the WstETH/USD price derivation.

### **Pyth**

In the context of the sBold protocol system, the Pyth adapter is IPriceOracle compliant and is responsible for executing the operations for the BOLD/USD feed. The adapter performs checks for confidence width, price staleness, and allowed exponent and scales the quote amount to a decimal precision of 18 by the exponent of the feed.

The oracle adapter is used for the BOLD/USD price derivation.
