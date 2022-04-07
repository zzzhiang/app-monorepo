/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { DrawerActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  FlatList,
  HStack,
  Icon,
  Pressable,
  SectionList,
  Select,
  Token,
  Typography,
  VStack,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import NetworksAllIndicator from '@onekeyhq/components/img/networks_all.png';
import type { Account as AccountEngineType } from '@onekeyhq/engine/src/types/account';
import { Wallet } from '@onekeyhq/engine/src/types/wallet';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useAppSelector,
  useSettings,
} from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
  ImportAccountModalRoutes,
  ImportAccountRoutesParams,
  WatchedAccountModalRoutes,
  WatchedAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { ManagerAccountModalRoutes } from '../../../routes/Modal/ManagerAccount';
import AccountModifyNameDialog from '../../../views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '../../../views/ManagerAccount/RemoveAccount';

import LeftSide from './LeftSide';
import RightHeader from './RightHeader';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams> &
  ModalScreenProps<ImportAccountRoutesParams> &
  ModalScreenProps<WatchedAccountRoutesParams> &
  ModalScreenProps<CreateWalletRoutesParams>;

export type AccountType = 'hd' | 'hw' | 'imported' | 'watching';

type CustomSelectTriggerProps = {
  isSelectVisible?: boolean;
  isTriggerHovered?: boolean;
};

const CustomSelectTrigger: FC<CustomSelectTriggerProps> = ({
  isSelectVisible,
  isTriggerHovered,
}) => (
  <Box
    p={2}
    borderRadius="xl"
    bg={
      // eslint-disable-next-line no-nested-ternary
      isSelectVisible
        ? 'surface-selected'
        : isTriggerHovered
        ? 'surface-hovered'
        : 'transparent'
    }
  >
    <Icon size={20} name="DotsHorizontalSolid" />
  </Box>
);

const AccountSelectorChildren: FC<{ isOpen?: boolean }> = ({ isOpen }) => {
  const data = [
    {
      title: 'BTC',
      chain: 'btc',
      data: [
        {
          address: '0x71a3d56acbeaa50968e2b9e7a60c50d46c9420ec',
          name: 'Account ##',
        },
        {
          address: '0x71a3d56acbeaa50968e2b9e7a60c50d46c9420ec',
          name: 'Account ##',
        },
      ],
    },
    {
      title: 'ETH',
      chain: 'eth',
      data: [
        {
          address: '0x71a3d56acbeaa50968e2b9e7a60c50d46c9420ec',
          name: 'Account ##',
        },
        {
          address: '0x71a3d56acbeaa50968e2b9e7a60c50d46c9420ec',
          name: 'Account ##',
        },
      ],
    },
    {
      title: 'BSC',
      chain: 'bsc',
      data: [
        {
          address: '0x71a3d56acbeaa50968e2b9e7a60c50d46c9420ec',
          name: 'Account ##',
        },
        {
          address: '0x71a3d56acbeaa50968e2b9e7a60c50d46c9420ec',
          name: 'Account ##',
        },
      ],
    },
  ];

  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { bottom } = useSafeAreaInsets();
  // const navigation = useNavigation<NavigationProps['navigation']>();
  const navigation = useAppNavigation();
  const { activeNetwork } = useAppSelector((s) => s.general);
  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();

  const [modifyNameVisible, setModifyNameVisible] = useState(false);
  const [modifyNameAccount, setModifyNameAccount] =
    useState<AccountEngineType>();

  const { account: currentSelectedAccount, wallet: defaultSelectedWallet } =
    useActiveWalletAccount();
  const wallets = useAppSelector((s) => s.wallet.wallets);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(
    defaultSelectedWallet,
  );

  const [activeAccounts, setActiveAccounts] = useState<AccountEngineType[]>([]);

  const activeWallet = useMemo(() => {
    const wallet =
      wallets.find((_wallet) => _wallet.id === selectedWallet?.id) ?? null;
    if (!wallet) setSelectedWallet(defaultSelectedWallet);
    return wallet;
  }, [defaultSelectedWallet, selectedWallet?.id, wallets]);

  const refreshAccounts = useCallback(() => {
    async function main() {
      if (!activeWallet) return;
      const accounts = await backgroundApiProxy.engine.getAccounts(
        activeWallet.accounts,
        activeNetwork?.network?.id,
      );

      setActiveAccounts(accounts);
    }
    return main();
  }, [activeNetwork?.network?.id, activeWallet]);

  const handleChange = useCallback(
    (item: AccountEngineType, value) => {
      switch (value) {
        case 'rename':
          setModifyNameAccount(item);
          setModifyNameVisible(true);

          break;
        case 'detail':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManagerAccount,
            params: {
              screen: ManagerAccountModalRoutes.ManagerAccountModal,
              params: {
                walletId: selectedWallet?.id ?? '',
                accountId: item.id,
                networkId: activeNetwork?.network.id ?? '',
              },
            },
          });
          break;
        case 'remove':
          if (selectedWallet?.type === 'watching') {
            showRemoveAccountDialog(
              selectedWallet?.id ?? '',
              item.id,
              undefined,
              () => {
                refreshAccounts();
                console.log('remove account', item.id);
              },
            );
          } else {
            showVerify(
              (pwd) => {
                showRemoveAccountDialog(
                  selectedWallet?.id ?? '',
                  item.id,
                  pwd,
                  () => {
                    refreshAccounts();
                    console.log('remove account', item.id);
                  },
                );
              },
              () => {},
            );
          }
          break;

        default:
          break;
      }
    },
    [
      activeNetwork?.network.id,
      navigation,
      refreshAccounts,
      selectedWallet?.id,
      selectedWallet?.type,
      showRemoveAccountDialog,
      showVerify,
    ],
  );

  function renderSideAction(
    type: AccountType | undefined,
    onChange: (v: string) => void,
  ) {
    return (
      <Select
        dropdownPosition="right"
        onChange={(v) => onChange(v)}
        activatable={false}
        options={[
          {
            label: intl.formatMessage({ id: 'action__rename' }),
            value: 'rename',
            iconProps: {
              name: isVerticalLayout ? 'TagOutline' : 'TagSolid',
            },
          },
          {
            label: intl.formatMessage({ id: 'action__view_details' }),
            value: 'detail',
            iconProps: {
              name: isVerticalLayout
                ? 'DocumentTextOutline'
                : 'DocumentTextSolid',
            },
          },
          {
            label: intl.formatMessage({ id: 'action__remove_account' }),
            value: 'remove',
            iconProps: {
              name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
            },
            destructive: true,
          },
        ]}
        headerShown={false}
        footer={null}
        containerProps={{ width: 'auto' }}
        dropdownProps={{
          width: 248,
        }}
        renderTrigger={(activeOption, isHovered, visible) => (
          <CustomSelectTrigger
            isTriggerHovered={isHovered}
            isSelectVisible={visible}
          />
        )}
      />
    );

    // if (type === 'imported') {
    //   return (
    //     <IconButton
    //       name="PlusSolid"
    //       type="plain"
    //       onPress={() => {
    //         navigation.navigate(RootRoutes.Modal, {
    //           screen: ModalRoutes.ImportAccount,
    //           params: {
    //             screen: ImportAccountModalRoutes.ImportAccountModal,
    //           },
    //         });
    //       }}
    //     />
    //   );
    // }
  }

  useEffect(() => {
    if (isOpen) {
      setSelectedWallet(defaultSelectedWallet);
    }
  }, [isOpen, defaultSelectedWallet]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  return (
    <>
      <LeftSide
        selectedWallet={activeWallet}
        setSelectedWallet={setSelectedWallet}
      />
      <VStack flex={1} pb={bottom}>
        <RightHeader selectedWallet={activeWallet} />
        <Box p={2}>
          <Select
            title={intl.formatMessage({ id: 'network__networks' })}
            footer={null}
            defaultValue="all"
            options={[
              {
                label: intl.formatMessage({ id: 'option__all' }),
                value: 'all',
                tokenProps: {
                  chain: 'all',
                },
              },
              {
                label: 'ETH',
                value: 'ethereum',
                tokenProps: {
                  chain: 'eth',
                },
              },
              {
                label: 'BSC',
                value: 'bsc',
                tokenProps: {
                  chain: 'bsc',
                },
              },
            ]}
          />
        </Box>
        {/* <FlatList
          px={2}
          contentContainerStyle={{
            paddingBottom: 16,
          }}
          data={activeAccounts}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                backgroundApiProxy.serviceAccount.changeActiveAccount({
                  account: item,
                  wallet: activeWallet,
                });
                setTimeout(() => {
                  navigation.dispatch(DrawerActions.closeDrawer());
                });
              }}
            >
              {({ isHovered }) => (
                <HStack
                  p="7px"
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'transparent'}
                  bg={
                    currentSelectedAccount?.id === item.id
                      ? 'surface-selected'
                      : 'transparent'
                  }
                  space={4}
                  borderRadius="xl"
                  alignItems="center"
                >
                  <Box flex={1}>
                    <Account
                      hiddenAvatar
                      address={item?.address ?? ''}
                      name={item.name}
                    />
                  </Box>
                  {renderSideAction(activeWallet?.type, (v) =>
                    handleChange(item, v),
                  )}
                </HStack>
              )}
            </Pressable>
          )}
        /> */}
        <SectionList
          px={2}
          stickySectionHeadersEnabled
          sections={data}
          SectionSeparatorComponent={(section) => (
            <Box h={!!section.leadingItem ? 2 : 0} />
          )}
          keyExtractor={(item, index) => item + index}
          renderItem={({ item }) => (
            <Pressable
            // onPress={() => {
            //   backgroundApiProxy.serviceAccount.changeActiveAccount({
            //     account: item,
            //     wallet: activeWallet,
            //   });
            //   setTimeout(() => {
            //     navigation.dispatch(DrawerActions.closeDrawer());
            //   });
            // }}
            >
              {({ isHovered }) => (
                <HStack
                  p="7px"
                  borderWidth={1}
                  borderColor={isHovered ? 'border-hovered' : 'transparent'}
                  // bg={
                  //   currentSelectedAccount?.id === item.id
                  //     ? 'surface-selected'
                  //     : 'transparent'
                  // }
                  space={4}
                  borderRadius="xl"
                  alignItems="center"
                >
                  <Box flex={1}>
                    <Account
                      hiddenAvatar
                      address={item?.address ?? ''}
                      name={item.name}
                    />
                  </Box>
                  {renderSideAction(activeWallet?.type, (v) =>
                    handleChange(item, v),
                  )}
                </HStack>
              )}
            </Pressable>
          )}
          renderSectionHeader={({ section: { title, chain } }) => (
            <Box p={2} bg="surface-subdued" flexDirection="row">
              <Token chain={chain} size={4} />
              <Typography.Subheading color="text-subdued" ml={2}>
                {title}
              </Typography.Subheading>
            </Box>
          )}
        />
        <Box p={2}>
          <Pressable
            onPress={() => {
              if (!activeWallet) return;
              if (activeWallet?.type === 'imported') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'privatekey' },
                  },
                });
              }
              if (activeWallet?.type === 'watching') {
                return navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.CreateWallet,
                  params: {
                    screen: CreateWalletModalRoutes.AddExistingWalletModal,
                    params: { mode: 'address' },
                  },
                });
              }

              return navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateAccount,
                params: {
                  screen: CreateAccountModalRoutes.CreateAccountForm,
                  params: {
                    walletId: activeWallet.id,
                  },
                },
              });
            }}
          >
            {({ isHovered }) => (
              <HStack
                py={3}
                borderRadius="xl"
                space={3}
                borderWidth={1}
                borderColor={isHovered ? 'border-hovered' : 'border-subdued'}
                borderStyle="dashed"
                alignItems="center"
                justifyContent="center"
              >
                <Icon name="UserAddOutline" />
                <Typography.Body2Strong color="text-subdued">
                  {intl.formatMessage({ id: 'action__add_account' })}
                </Typography.Body2Strong>
              </HStack>
            )}
          </Pressable>
        </Box>
      </VStack>
      {RemoveAccountDialog}
      <AccountModifyNameDialog
        visible={modifyNameVisible}
        account={modifyNameAccount}
        onClose={() => setModifyNameVisible(false)}
        onDone={(account) => {
          refreshAccounts();
          console.log('account modify name', account.id);
        }}
      />
    </>
  );
};

export default AccountSelectorChildren;
