/// <reference path="./matchers/beWithin.ts"/>

import { AlgebraFixtureType } from './shared/fixtures'

export type TestContext = AlgebraFixtureType & {
  subject?: Function
}
