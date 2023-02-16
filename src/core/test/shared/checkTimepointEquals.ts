import { BigNumber, BigNumberish } from 'ethers'
import { expect } from './expect'

// helper function because we cannot do a simple deep equals with the
// timepoint result object returned from ethers because it extends array
export default function checkTimepointEquals(
  {
    initialized,
    tickCumulative,
    blockTimestamp,
  }: {
    initialized: boolean
    tickCumulative: BigNumber
    blockTimestamp: number
  },
  expected: {
    initialized: boolean
    tickCumulative: BigNumberish
    blockTimestamp: number
  }
) {
  expect(
    {
      initialized,
      blockTimestamp,
      tickCumulative: tickCumulative.toString(),
    },
    `timepoint is equivalent`
  ).to.deep.eq({
    ...expected,
    tickCumulative: expected.tickCumulative.toString(),
  })
}
