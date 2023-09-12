import CryptoCurrencyIcon from 'components/primitives/CryptoCurrencyIcon'
import {
  Box,
  Button,
  Flex,
  FormatCrypto,
  FormatCurrency,
  Text,
} from 'components/primitives'
import { goerli, polygonMumbai, sepolia } from 'wagmi/chains'
import { useAccount, useContractReads, erc20ABI, useBalance } from 'wagmi'
import { useMemo, useState } from 'react'
import { zeroAddress, formatUnits } from 'viem'
import wrappedContracts from 'utils/wrappedContracts'
import { useCoinConversion } from '@reservoir0x/reservoir-kit-ui'

//CONFIGURABLE: Here you may configure currencies that you want to display in the wallet menu. Native currencies,
//like ETH/MATIC etc need to be fetched in a different way. Configure them below
const currencies = [
  {
    address: zeroAddress,
    symbol: goerli.nativeCurrency.symbol,
    decimals: goerli.nativeCurrency.decimals,
    chain: {
      id: goerli.id,
      name: goerli.name,
    },
    coinGeckoId: 'ethereum',
  },
  {
    address: wrappedContracts[goerli.id],
    symbol: 'WETH',
    decimals: goerli.nativeCurrency.decimals,
    chain: {
      id: goerli.id,
      name: goerli.name,
    },
    coinGeckoId: 'weth',
  },
  {
    address: zeroAddress,
    symbol: polygonMumbai.nativeCurrency.symbol,
    decimals: polygonMumbai.nativeCurrency.decimals,
    chain: {
      id: polygonMumbai.id,
      name: polygonMumbai.name,
    },
    coinGeckoId: 'matic-network',
  },
  {
    address: wrappedContracts[polygonMumbai.id],
    symbol: 'WETH',
    decimals: polygonMumbai.nativeCurrency.decimals,
    chain: {
      id: polygonMumbai.id,
      name: polygonMumbai.name,
    },
    coinGeckoId: 'weth',
  },
  {
    address: zeroAddress,
    symbol: sepolia.nativeCurrency.symbol,
    decimals: sepolia.nativeCurrency.decimals,
    chain: {
      id: sepolia.id,
      name: sepolia.name,
    },
    coinGeckoId: 'ethereum',
  },
  {
    address: wrappedContracts[sepolia.id],
    symbol: 'WETH',
    decimals: sepolia.nativeCurrency.decimals,
    chain: {
      id: sepolia.id,
      name: sepolia.name,
    },
    coinGeckoId: 'ethereum',
  },
]

type EnhancedCurrency = (typeof currencies)[0] & {
  usdPrice: number
  balance: string | number | bigint
}

const nonNativeCurrencies = currencies.filter(
  (currency) => currency.address !== zeroAddress
)

const currencySymbols = currencies.map((currency) => currency.symbol).join(',')
const currencyCoingeckoIds = currencies
  .map((currency) => currency.coinGeckoId)
  .join(',')

const Wallet = () => {
  const [viewAll, setViewAll] = useState(false)
  const { address } = useAccount()
  const { data: nonNativeBalances } = useContractReads({
    contracts: nonNativeCurrencies.map((currency) => ({
      abi: erc20ABI,
      address: currency.address as `0x${string}`,
      chainId: currency.chain.id,
      functionName: 'balanceOf',
      args: [address as any],
    })),
    watch: true,
    enabled: address ? true : false,
    allowFailure: false,
  })

  //CONFIGURABLE: Configure these by just changing the chainId to fetch native balance info, in addition to changing this
  // also make sure you change the enhancedCurrencies function to take into account for these new balances
  const goerliBalance = useBalance({
    address,
    chainId: goerli.id,
  })
  const maticBalance = useBalance({
    address,
    chainId: polygonMumbai.id,
  })
  const sepoliaBalance = useBalance({
    address,
    chainId: sepolia.id,
  })

  const usdConversions = useCoinConversion(
    'USD',
    currencySymbols,
    currencyCoingeckoIds
  )

  const enhancedCurrencies = useMemo(() => {
    const currencyToUsdConversions = usdConversions.reduce((map, data) => {
      map[data.symbol] = data
      map[(data as any).coinGeckoId] = data
      return map
    }, {} as Record<string, (typeof usdConversions)[0]>)

    return currencies.map((currency, i) => {
      let balance: string | number | bigint = 0n
      if (currency.address === zeroAddress) {
        //CONFIGURABLE: Configure these to show the fetched balance results configured above in the useBalance hooks
        switch (currency.chain.id) {
          case polygonMumbai.id: {
            balance = maticBalance.data?.value || 0n
            break
          }
          case goerli.id: {
            balance = goerliBalance.data?.value || 0n
            break
          }
          case sepolia.id: {
            balance = sepoliaBalance.data?.value || 0n
            break
          }
        }
      } else {
        const index = nonNativeCurrencies.findIndex(
          (nonNativeCurrency) =>
            nonNativeCurrency.chain.id === currency.chain.id &&
            nonNativeCurrency.symbol === currency.symbol &&
            nonNativeCurrency.coinGeckoId === currency.coinGeckoId
        )
        balance =
          nonNativeBalances &&
          nonNativeBalances[index] &&
          (typeof nonNativeBalances[index] === 'string' ||
            typeof nonNativeBalances[index] === 'number' ||
            typeof nonNativeBalances[index] === 'bigint')
            ? (nonNativeBalances[index] as string | number | bigint)
            : 0n
      }

      const conversion =
        currencyToUsdConversions[
          currency.coinGeckoId.length > 0
            ? currency.coinGeckoId
            : currency.symbol.toLowerCase()
        ]
      const usdPrice =
        Number(formatUnits(BigInt(balance), currency?.decimals || 18)) *
        (conversion?.price || 0)
      return {
        ...currency,
        usdPrice,
        balance,
      }
    }) as EnhancedCurrency[]
    //CONFIGURABLE: Configure these to regenerate whenever a native balance changes, non native balances are already handled
  }, [
    usdConversions,
    nonNativeBalances,
    goerliBalance,
    maticBalance,
    sepoliaBalance,
  ])

  const totalUsdBalance = useMemo(() => {
    return enhancedCurrencies.reduce(
      (total, { usdPrice }) => total + usdPrice,
      0
    )
  }, [enhancedCurrencies])

  const visibleCurrencies = viewAll
    ? enhancedCurrencies
    : enhancedCurrencies.slice(0, 3)

  return (
    <Flex
      direction="column"
      align="center"
      css={{
        background: '$gray2',
        border: '1px solid $gray3',
        borderRadius: 8,
        mt: '$3',
      }}
    >
      <Box css={{ width: '100%', height: 1, background: '$gray1' }}></Box>
      <Flex direction="column" align="center" css={{ p: '$4', width: '100%' }}>
        <Text style="body2" color="subtle" css={{ mb: '$2', mt: '$2' }}>
          Total Balance
        </Text>
        <FormatCurrency
          style="h4"
          amount={totalUsdBalance}
          css={{ mb: '$4' }}
        />
        <Button
          css={{ width: '100%', justifyContent: 'center' }}
          onClick={() => {
            window.open('https://app.uniswap.org/', '_blank')
          }}
        >
          Add Funds
        </Button>
        {visibleCurrencies.map((currency, i) => {
          return (
            <Flex
              key={i}
              css={{ width: '100%', mt: 28, gap: '$3' }}
              align="center"
            >
              <Flex
                css={{
                  width: 40,
                  height: 40,
                  background: '$gray3',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
                align="center"
                justify="center"
              >
                <CryptoCurrencyIcon
                  address={currency.address}
                  chainId={currency.chain.id}
                  css={{ height: 24 }}
                />
              </Flex>
              <Flex direction="column" justify="center" css={{ width: '100%' }}>
                <Flex justify="between">
                  <Text style="body1">{currency.symbol}</Text>
                  <FormatCrypto
                    amount={currency.balance}
                    decimals={currency.decimals}
                    textStyle="body1"
                  />
                </Flex>
                <Flex justify="between">
                  <Text style="body2" color="subtle">
                    {currency.chain.name}
                  </Text>
                  <Text style="body2" color="subtle"></Text>
                  <FormatCurrency amount={currency.usdPrice} />
                </Flex>
              </Flex>
            </Flex>
          )
        })}
        <Button
          css={{
            width: '100%',
            justifyContent: 'center',
            mt: 24,
            mb: '$3',
          }}
          color="gray3"
          onClick={() => {
            setViewAll(!viewAll)
          }}
        >
          View {viewAll ? 'Fewer' : 'All'} Tokens
        </Button>
      </Flex>
    </Flex>
  )
}

export default Wallet
