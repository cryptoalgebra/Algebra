import { AlgebraFixtureType } from './shared/fixtures';

export type TestContext = AlgebraFixtureType & {
  subject?: Function;
};
