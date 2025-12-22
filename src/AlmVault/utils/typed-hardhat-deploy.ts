/* eslint-disable @typescript-eslint/no-explicit-any */
import { ethers } from "ethers";
import {
  CallOptions,
  Deployment,
  DeploymentsExtension,
  DeployOptions,
  DeployResult,
  Receipt,
  TxOptions,
} from "hardhat-deploy/types";
import { Awaited } from "ts-essentials";

interface TypedDeployments<CustomNames extends Record<string, keyof Factories>> extends DeploymentsExtension {
  deploy<N extends keyof Factories>(name: N, options: TypedDeployOptions<N>): Promise<DeployResult>;
  deploy<N extends keyof CustomNames>(
    name: N,
    options: TypedDeployOptionsWithContract<CustomNames[N]>
  ): Promise<DeployResult>;
  execute<N extends keyof Contracts, M extends keyof Contracts[N]["functions"]>(
    name: N,
    options: TxOptions,
    methodName: M,
    ...args: SafeParameters<Contracts[N]["functions"][M]>
  ): Promise<Receipt>;
  read<N extends keyof Contracts, M extends keyof Contracts[N]["callStatic"]>(
    name: N,
    options: CallOptions,
    methodName: M,
    ...args: SafeParameters<Contracts[N]["callStatic"][M]>
  ): SafeReturnType<Contracts[N]["callStatic"][M]>;
  read<N extends keyof Contracts, M extends keyof Contracts[N]["callStatic"]>(
    name: N,
    methodName: M,
    ...args: SafeParameters<Contracts[N]["callStatic"][M]>
  ): SafeReturnType<Contracts[N]["callStatic"][M]>;
  get<N extends keyof Contracts | keyof CustomNames>(name: N): Promise<Deployment>;
}

export function typedDeployments<N extends Record<string, keyof Factories>>(
  deployments: DeploymentsExtension
): TypedDeployments<N> {
  return deployments as TypedDeployments<N>;
}

type _Typechain = typeof import("../types");
type _Factories0 = {
  [key in keyof _Typechain as key extends `${infer N}__factory` ? N : never]: InstanceType<_Typechain[key]>;
};
type Factories = Pick<
  _Factories0,
  {
    [key in keyof _Factories0]: _Factories0[key] extends ethers.ContractFactory ? key : never;
  }[keyof _Factories0]
>;
interface TypedDeployOptions<N extends keyof Factories> extends DeployOptions {
  args: Parameters<Factories[N]["deploy"]>;
}
interface TypedDeployOptionsWithContract<N extends keyof Factories> extends TypedDeployOptions<N> {
  contract: N;
}

type Contracts = {
  [key in keyof Factories]: Awaited<ReturnType<Factories[key]["deploy"]>>;
};

type SafeParameters<T> = T extends (...args: any[]) => any ? Parameters<T> : never;
type SafeReturnType<T> = T extends (...args: any[]) => any ? ReturnType<T> : never;
