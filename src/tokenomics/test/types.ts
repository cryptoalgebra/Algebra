/// <reference path="./matchers/beWithin.ts"/>

import { createFixtureLoader } from './shared/provider'
import { AlgebraFixtureType, EternalAlgebraFixtureType } from './shared/fixtures'

export type LoadFixtureFunction = ReturnType<typeof createFixtureLoader>

export type TestContext = AlgebraFixtureType | EternalAlgebraFixtureType & {
  subject?: Function
}
