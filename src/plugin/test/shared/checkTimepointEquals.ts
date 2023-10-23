import { expect } from './expect';

// helper function because we cannot do a simple deep equals with the
// timepoint result object returned from ethers because it extends array
export default function checkTimepointEquals(
  {
    initialized,
    tickCumulative,
    blockTimestamp,
  }: {
    initialized: boolean;
    tickCumulative: bigint;
    blockTimestamp: bigint;
  },
  expected: {
    initialized: boolean;
    tickCumulative: bigint;
    blockTimestamp: bigint;
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
  });
}
