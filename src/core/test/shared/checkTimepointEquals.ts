import { BigNumber, BigNumberish } from 'ethers'
import { expect } from './expect'

// helper function because we cannot do a simple deep equals with the
// timepoint result object returned from ethers because it extends array
export default function checkTimepointEquals(
  {
    initialized,
    tickCumulative,
    blockTimestamp,
    secondsPerLiquidityCumulative,
  }: {
    initialized: boolean
    tickCumulative: BigNumber
    secondsPerLiquidityCumulative: BigNumber
    blockTimestamp: number
  },
  expected: {
    initialized: boolean
    tickCumulative: BigNumberish
    secondsPerLiquidityCumulative: BigNumberish
    blockTimestamp: number
  }
) {
  expect(
    {
      initialized,
      blockTimestamp,
      tickCumulative: tickCumulative.toString(),
      secondsPerLiquidityCumulative: secondsPerLiquidityCumulative.toString(),
    },
    `timepoint is equivalent`
  ).to.deep.eq({
    ...expected,
    tickCumulative: expected.tickCumulative.toString(),
    secondsPerLiquidityCumulative: expected.secondsPerLiquidityCumulative.toString(),
  })
}
