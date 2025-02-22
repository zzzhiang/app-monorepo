import { TypedUseSelectorHook, useSelector } from 'react-redux';

import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';

import { appDispatch, appSelector } from '../store';

import type { IAppState } from '../store';
import type { Network } from '../store/reducers/network';

export const useAppDispatch = () => {
  console.error(
    '`useAppDispatch()` is deprecated. use `const { dispatch } = backgroundApiProxy;` instead.',
  );
  return appDispatch;
};
export const useAppSelector: TypedUseSelectorHook<IAppState> = useSelector;

export type ISelectorBuilder = (selector: typeof useAppSelector) => unknown;

export function makeSelector<T>(builder: ISelectorBuilder) {
  return {
    // hooks for UI
    use: (): T => builder(useAppSelector) as T,
    // getter for Background
    get: (): T => builder(appSelector) as T,
  };
}

export const useSettings = () => {
  const settings = useAppSelector((s) => s.settings);
  return settings;
};

export const useDiscover = () => {
  const discover = useAppSelector((s) => s.discover);
  return discover;
};

export const useStatus = () => {
  const status = useAppSelector((s) => s.status);
  return status;
};

export const useData = () => {
  const data = useAppSelector((s) => s.data);
  return data;
};

export const useGeneral = () => {
  const general = useAppSelector((s) => s.general);
  return general;
};

export type IActiveWalletAccount = {
  wallet: Wallet | null;
  account: Account | null;
  network: {
    network: Network;
    sharedChainName: string;
  } | null;
  networkId: string;
  accountId: string;
  networkImpl: string;
  accountAddress: string;
};

export const { use: useActiveWalletAccount, get: getActiveWalletAccount } =
  makeSelector<IActiveWalletAccount>((selector) => {
    const { activeAccount, activeWallet, activeNetwork } = selector(
      (s) => s.general,
    );

    const activeAccountInfo = activeAccount;
    const networkImpl = activeNetwork?.network?.impl || '';
    const networkId = activeNetwork?.network?.id || '';
    const accountAddress = activeAccountInfo?.address || '';
    const accountId = activeAccount?.id || '';

    return {
      wallet: activeWallet,
      account: activeAccount,
      network: activeNetwork,
      accountId,
      networkId,
      networkImpl,
      accountAddress,
    };
  });
