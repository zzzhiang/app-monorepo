import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  Select,
  Token,
  Typography,
} from '@onekeyhq/components';
import { SelectGroupItem, SelectItem } from '@onekeyhq/components/src/Select';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { updateActiveChainId } from '@onekeyhq/kit/src/store/reducers/chain';
import {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '@onekeyhq/kit/src/views/ManageNetworks/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import engine from '../../engine/EngineProvider';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkListViewModal
>;
const ChainSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const [options, setOptions] = useState<SelectGroupItem[]>([]);

  const dispatch = useAppDispatch();
  const activeChainId = useAppSelector((s) => s.chain.chainId);

  const handleActiveChainChange = useCallback(
    (chainId) => {
      dispatch(updateActiveChainId(chainId));
      const chainIdHex = {
        ethereum: '0x1',
        bsc: '0x38',
        heco: '0x80',
        polygon: '0x89',
        fantom: '0xfa',
      }[chainId as string];
      if (!chainIdHex) {
        throw new Error('chainId not available.');
      }
      if (chainIdHex) {
        backgroundApiProxy.changeChain(chainIdHex);
      }
    },
    [dispatch],
  );

  const loadNetWork = async () => {
    const networkChainOptions: SelectGroupItem[] = [];

    const networkChains = await engine.listNetworks();
    console.log('networkChains==', networkChains);
    networkChains.forEach((chains, key) => {
      const networkOptions: SelectItem[] = [];
      chains.forEach((chain) => {
        networkOptions.push({
          label: chain.symbol,
          value: chain.name,
          tokenProps: {
            src: chain.logoURI,
            chain: chain.id,
          },
        });
      });
      networkChainOptions.push({
        title: key.toUpperCase(),
        options: networkOptions,
      });
    });

    setOptions(networkChainOptions);
  };

  useEffect(() => {
    loadNetWork();
    // add network and get chain list pass
    // const impl = 'evm';
    // engine
    //   .addNetwork(impl, {
    //     name: 'heco',
    //     symbol: 'HECO',
    //     rpcURL: 'https://heco.onekey.network',
    //   })
    //   .then((network) => {
    //     console.log('addNetwork==', network);
    //   })
    //   .catch((e) => {
    //     console.log('addNetwork==', e);
    //  });
    // create HD wallet and add HD account pass
    // const passwd = '123456';
    // const walletID = 'hd-1';
    // const networkId = 'evm--1-1';
    // engine
    //   .createHDWallet(passwd)
    //   .then((wallet) => {
    //     console.log('createHDWallet==', wallet);
    //   })
    //   .catch((e) => {
    //     console.log('createHDWallet error ==', e);
    //   });
    // engine
    //   .addHDAccount(passwd, walletID, networkId)
    //   .then((account) => {
    //     console.log('addHDAccount==', account);
    //   })
    //   .catch((e) => {
    //     console.log('addHDAccount==', e);
    //   });
    // add watching account    pass
    // const address = '0xa63A81e3921169b5Fd565D54Fc84c9a359893CB2';
    // engine
    //   .addWatchingAccount(networkId, address)
    //   .then((account) => {
    //     console.log('addWatchingAccount==', account);
    //   })
    //   .catch((e) => {
    //     console.log('addWatchingAccount==', e);
    //   });
  }, []);

  return (
    <Box>
      <Select
        dropdownPosition="right"
        dropdownProps={{ w: '56' }}
        value={activeChainId}
        onChange={handleActiveChainChange}
        title="Networks"
        options={options}
        footerText={intl.formatMessage({ id: 'action__customize_network' })}
        footerIcon="PencilSolid"
        isTriggerPlain
        onPressFooter={() =>
          setTimeout(() => {
            navigation.navigate(ManageNetworkModalRoutes.NetworkListViewModal);
          }, 200)
        }
        renderTrigger={(activeOption, isHovered, visible) => (
          <HStack
            p={2}
            space={1}
            bg={
              // eslint-disable-next-line no-nested-ternary
              visible
                ? 'surface-selected'
                : isHovered
                ? 'surface-hovered'
                : 'surface-default'
            }
            borderRadius="xl"
            alignItems="center"
          >
            <HStack space={{ base: 2, md: 3 }} alignItems="center">
              <Token size={{ base: 5, md: 6 }} {...activeOption.tokenProps} />
              <Typography.Body2Strong>
                {activeOption.label}
              </Typography.Body2Strong>
            </HStack>
            <Icon size={20} name="ChevronDownSolid" />
          </HStack>
        )}
      />
    </Box>
  );
};

export default ChainSelector;
