/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Buffer } from 'buffer';

import Realm from 'realm';

import {
  RevealableSeed,
  mnemonicFromEntropy,
} from '@onekeyhq/blockchain-libs/dist/secret';

import {
  NotImplemented,
  OneKeyInternalError,
  WrongPassword,
} from '../../errors';
import { presetNetworksList } from '../../presets';
import { ACCOUNT_TYPE_SIMPLE, DBAccount } from '../../types/account';
import { DBNetwork } from '../../types/network';
import { Token } from '../../types/token';
import {
  DBWallet,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
} from '../../types/wallet';
import {
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedCredential,
  checkPassword,
  encrypt,
} from '../base';

import {
  AccountSchema,
  ContextSchema,
  CredentialSchema,
  NetworkSchema,
  TokenSchema,
  WalletSchema,
} from './schemas';
/**
 * Realm DB API
 * @implements { DBAPI }
 * @NOTE: REMEMBER TO CLOSE REALM CONNECTION BEFORE EXITING APP USE `close()` METHOD
 */
class RealmDB implements DBAPI {
  #realm: Realm | undefined;

  private update: boolean;

  /**
   * set update flag to true when you want to update preset networks
   * @throws {OneKeyInternalError}
   */
  constructor(update = false) {
    this.update = update;
    Realm.open({
      path: 'oneKey.realm',
      schema: [
        NetworkSchema,
        TokenSchema,
        WalletSchema,
        AccountSchema,
        ContextSchema,
        CredentialSchema,
      ],
    })
      .then((realm) => {
        if (update || realm.empty) {
          realm.write(() => {
            presetNetworksList.forEach((network, index) => {
              realm.create(
                'Network',
                {
                  id: network.id,
                  name: network.name,
                  impl: network.impl,
                  symbol: network.symbol,
                  logo_uri: network.logoURI,
                  fee_symbol: network.feeSymbol,
                  decimals: network.decimals,
                  fee_decimals: network.feeDecimals,
                  balance2_fee_decimals: network.balance2FeeDecimals,
                  rpc_url: network.presetRpcURLs[0],
                  enabled: network.enabled,
                  preset: true,
                  position: index,
                },
                Realm.UpdateMode.Modified,
              );
            });
          });
        }
        this.#realm = realm;
      })
      .catch((error: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error('Failed to open the realm', error.message);
        throw new OneKeyInternalError('Failed to open the realm');
      });
  }

  close(): void {
    if (this.#realm && !this.#realm.isClosed) {
      this.#realm.close();
    }
  }

  /**
   * list all added networks in added desc order
   * @returns {Promise<DBNetwork[]>}
   */
  listNetworks(): Promise<DBNetwork[]> {
    const networks: Realm.Results<NetworkSchema> =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.#realm!.objects<NetworkSchema>('Network').sorted('position', true);
    return Promise.resolve(networks as unknown as DBNetwork[]);
  }

  addNetwork(network: DBNetwork): Promise<DBNetwork> {
    try {
      const position: number =
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.#realm!.objects<NetworkSchema>('Network').max(
          'position',
        ) as unknown as number;
      this.#realm!.write(() => {
        this.#realm!.create('Network', {
          id: network.id,
          name: network.name,
          impl: network.impl,
          symbol: network.symbol,
          logoURI: network.logoURI,
          feeSymbol: network.feeSymbol,
          decimals: network.decimals,
          feeDecimals: network.feeDecimals,
          balance2FeeDecimals: network.balance2FeeDecimals,
          rpcURL: network.rpcURL,
          enabled: network.enabled,
          position: position + 1,
        });
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve(network);
  }

  /**
   * get the network by id
   * @param networkId
   * @returns {Promise<DBNetwork>}
   */
  getNetwork(networkId: string): Promise<DBNetwork> {
    const network: NetworkSchema | undefined =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.#realm!.objectForPrimaryKey<NetworkSchema>('Network', networkId);
    if (typeof network === 'undefined') {
      return Promise.reject(
        new OneKeyInternalError(`Network ${networkId} not found.`),
      );
    }
    return Promise.resolve(network as unknown as DBNetwork);
  }

  /**
   * update network list.
   * @param networks list of tuples of network id and enabled flag
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: networks must include all networks exist
   */
  updateNetworkList(networks: [string, boolean][]): Promise<void> {
    try {
      const size = this.#realm!.objects<NetworkSchema>('Network').length;
      if (size !== networks.length) {
        return Promise.reject(
          new OneKeyInternalError(
            `Network list length not match, expected ${size} but got ${networks.length}`,
          ),
        );
      }
      this.#realm!.write(() => {
        networks.forEach(([id, enabled], position) => {
          this.#realm!.create(
            'Network',
            {
              id,
              enabled,
              position,
            },
            Realm.UpdateMode.Modified,
          );
        });
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  /**
   * update network with given id and associated params.
   * @param networkId
   * @param params
   * @returns {Promise<DBNetwork>}
   */
  updateNetwork(
    networkId: string,
    params: {
      name?: string;
      symbol?: string;
      rpcURL?: string;
    },
  ): Promise<DBNetwork> {
    let network: NetworkSchema | undefined;
    try {
      this.#realm!.write(() => {
        network =
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.#realm!.objectForPrimaryKey<NetworkSchema>('Network', networkId);
        if (typeof network === 'undefined') {
          return Promise.reject(
            new OneKeyInternalError(`Network ${networkId} not found.`),
          );
        }
        if (params.name) {
          network.name = params.name;
        }
        if (params.symbol) {
          network.symbol = params.symbol;
        }
        if (params.rpcURL) {
          network.rpcURL = params.rpcURL;
        }
      });
      return Promise.resolve(network as unknown as DBNetwork);
    } catch (error) {
      console.error(error);
      return Promise.reject(error);
    }
  }

  /**
   * delete network by given network id
   * @param networkId
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: network must exist and must be not preset
   */
  deleteNetwork(networkId: string): Promise<void> {
    try {
      const network = this.#realm!.objectForPrimaryKey<NetworkSchema>(
        'Network',
        networkId,
      );
      if (typeof network !== 'undefined' && !network.preset) {
        this.#realm!.write(() => {
          this.#realm!.delete(network);
        });
      } else if (typeof network === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Network ${networkId} not found.`),
        );
      } else {
        return Promise.reject(
          new OneKeyInternalError(
            `Network ${networkId} is preset. delete is forbidden.`,
          ),
        );
      }
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  /**
   * add new customer token
   * @param token
   */
  addToken(token: Token): Promise<Token> {
    try {
      this.#realm!.write(() => {
        this.#realm!.create('Token', {
          id: token.id,
          name: token.name,
          token_id: token.tokenIdOnNetwork,
          symbol: token.symbol,
          decimals: token.decimals,
          networkId: token.networkId,
        });
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve(token);
  }

  /**
   * get token by id
   * @param tokenId
   * @returns {Promise<Token>}
   * @throws {OneKeyInternalError}
   */
  getToken(tokenId: string): Promise<Token | undefined> {
    let token: TokenSchema | undefined;
    try {
      token = this.#realm!.objectForPrimaryKey<TokenSchema>('Token', tokenId);
      if (typeof token === 'undefined') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(token as unknown as Token);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get token list by network id and associated account id
   * @param networkId
   * @param accountId optional
   * @returns {Promise<Token[]>}
   * @throws {OneKeyInternalError}
   */
  getTokens(networkId: string, accountId?: string): Promise<Token[]> {
    let tokens: Realm.Results<TokenSchema> | undefined;
    try {
      if (typeof accountId === 'undefined') {
        tokens = this.#realm!.objects<TokenSchema>('Token').filtered(
          'network_id = $0',
          networkId,
        );
      } else {
        const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
          'Account',
          accountId,
        );
        if (typeof account === 'undefined') {
          return Promise.reject(
            new OneKeyInternalError(`Account ${accountId} not found.`),
          );
        }
        tokens = account.tokens?.filtered('network_id = $0', networkId);
      }
      return Promise.resolve(tokens as unknown as Token[]);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * associate token with account
   * @param accountId
   * @param tokenId
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: token and account must exist already
   */
  addTokenToAccount(accountId: string, tokenId: string): Promise<Token> {
    try {
      const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      const token = this.#realm!.objectForPrimaryKey<TokenSchema>(
        'Token',
        tokenId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (typeof token === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Token ${tokenId} not found.`),
        );
      }
      this.#realm!.write(() => {
        account.tokens?.add(token);
      });
      return Promise.resolve(token as unknown as Token);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * remove token from account
   * @param accountId
   * @param tokenId
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: token and account must exist already
   */
  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void> {
    try {
      const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      const token = this.#realm!.objectForPrimaryKey<TokenSchema>(
        'Token',
        tokenId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (typeof token === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Token ${tokenId} not found.`),
        );
      }
      this.#realm!.write(() => {
        if (account.tokens?.includes(token)) {
          account.tokens.delete(token);
        }
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * retrieve all accounts
   * @returns {Promise<DBWallet[]>}
   */
  getWallets(): Promise<DBWallet[]> {
    try {
      const wallets = this.#realm!.objects<DBWallet>('Wallet');
      return Promise.resolve(wallets as unknown as DBWallet[]);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get a certain wallet by id
   * @param walletId
   * @returns {Promise<DBWallet | undefined>}
   * @throws {OneKeyInternalError}
   */
  getWallet(walletId: string): Promise<DBWallet | undefined> {
    try {
      const wallet = this.#realm!.objectForPrimaryKey<DBWallet>(
        'Wallet',
        walletId,
      );
      return Promise.resolve(wallet);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * associate account with wallet
   * @param walletId
   * @param account
   * @returns {Promise<DBAccount>}
   * @throws {OneKeyInternalError}
   * @NOTE: account and wallet must exist already
   */
  addAccountToWallet(walletId: string, account: DBAccount): Promise<DBAccount> {
    try {
      const wallet = this.#realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      const accountFind = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        account.id,
      );
      if (typeof accountFind === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${account.id} not found.`),
        );
      }
      this.#realm!.write(() => {
        wallet.accounts?.add(accountFind);
      });
      return Promise.resolve(account as unknown as DBAccount);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get account list by given account id list
   * @param accountIds
   * @returns {Promise<DBAccount[]>}
   * @throws {OneKeyInternalError}
   *
   */
  getAccounts(accountIds: string[]): Promise<DBAccount[]> {
    try {
      const accounts = this.#realm!.objects<AccountSchema>('Account').filtered(
        'id IN $0',
        accountIds,
      );
      return Promise.resolve(accounts as unknown as DBAccount[]);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get a certain account by id
   * @param accountId
   * @returns {Promise<DBAccount>}
   * @throws {OneKeyInternalError}
   */
  getAccount(accountId: string): Promise<DBAccount> {
    try {
      const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      return Promise.resolve(account as unknown as DBAccount);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * create a new HD wallet
   * @param password
   * @param rs
   * @param name
   * @returns
   * @throws { OneKeyInternalError, WrongPassword }
   */
  createHDWallet(
    password: string,
    rs: RevealableSeed,
    name?: string,
  ): Promise<DBWallet> {
    try {
      const context = this.#realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        'mainContext',
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context, password)) {
        return Promise.reject(new WrongPassword());
      }
      const walletId = `hd-${context.nextHD}`;
      let wallet: WalletSchema | undefined;
      this.#realm!.write(() => {
        wallet = this.#realm!.create('Wallet', {
          id: walletId,
          name: name || `HD Wallet ${context.nextHD}`,
          type: WALLET_TYPE_HD,
        });
        this.#realm!.create('Credential', {
          id: walletId,
          credential: JSON.stringify({
            entropy: rs.entropyWithLangPrefixed.toString('hex'),
            seed: rs.seed.toString('hex'),
          }),
        });
        if (context.verifyString === DEFAULT_VERIFY_STRING) {
          context.verifyString = encrypt(
            password,
            Buffer.from(DEFAULT_VERIFY_STRING),
          ).toString('hex');
          context.nextHD += 1;
        }
      });
      // in order to disable lint error, here wallet is undefined is impossible ??
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError('Wallet creation failed.'),
        );
      }
      return Promise.resolve(wallet as unknown as DBWallet);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * remove a wallet(type hd or hw only) by id
   * @param walletId
   * @param password
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError, WrongPassword}
   * @NOTE: associated accounts will be removed and credential will be removed if necessary(hw is not necessary)
   */
  removeWallet(walletId: string, password: string): Promise<void> {
    try {
      const wallet = this.#realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (
        (wallet.type as string) !== WALLET_TYPE_HD &&
        (wallet.type as string) !== WALLET_TYPE_HD
      ) {
        return Promise.reject(
          new OneKeyInternalError('Only HD or HW wallet can be removed.'),
        );
      }
      const context = this.#realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        'mainContext',
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context, password)) {
        return Promise.reject(new WrongPassword());
      }
      const credential = this.#realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        walletId,
      );
      this.#realm!.write(() => {
        // associate accounts will automatically keep track the deletion ????
        this.#realm!.delete(wallet);
        if (typeof credential !== 'undefined') {
          this.#realm!.delete(credential);
        }
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * rename a already existing wallet
   * @param walletId
   * @param name
   * @returns {Promise<DBWallet>}
   * @throws {OneKeyInternalError}
   */
  setWalletName(walletId: string, name: string): Promise<DBWallet> {
    try {
      const wallet = this.#realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (
        (wallet.type as string) !== WALLET_TYPE_HD &&
        (wallet.type as string) !== WALLET_TYPE_HW
      ) {
        return Promise.reject(
          new OneKeyInternalError('Only HD or HW wallet name can be set.'),
        );
      }
      this.#realm!.write(() => {
        wallet.name = name;
      });
      return Promise.resolve(wallet as unknown as DBWallet);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * retrieve the stored credential of a wallet
   * @param walletId
   * @param password
   * @returns {Promise<ExportedCredential>}
   * @throws {OneKeyInternalError, WrongPassword}
   * @NOTE: this method is only used for hd wallet
   */
  getCredential(
    walletId: string,
    password: string,
  ): Promise<ExportedCredential> {
    try {
      const context = this.#realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        'mainContext',
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context, password)) {
        return Promise.reject(new WrongPassword());
      }
      const credential = this.#realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        walletId,
      );
      if (typeof credential === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Credential ${walletId} not found.`),
        );
      }
      const credentialJSON = JSON.parse(credential.credential);
      return Promise.resolve({
        mnemonic: mnemonicFromEntropy(
          Buffer.from(credentialJSON.entropy, 'hex'),
          password,
        ),
        seed: Buffer.from(credentialJSON.seed, 'hex'),
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   *  change the wallet backup status if necessary
   * @param walletId
   * @returns {Promise<DBWallet>}
   * @throws {OneKeyInternalError}
   */
  confirmHDWalletBackuped(walletId: string): Promise<DBWallet> {
    try {
      const wallet = this.#realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (wallet.type !== WALLET_TYPE_HD) {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`),
        );
      }
      if (!wallet.backuped) {
        this.#realm!.write(() => {
          wallet.backuped = true;
        });
      }
      return Promise.resolve(wallet as unknown as DBWallet);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * remove a certain account from a certain wallet
   * @param walletId
   * @param accountId
   * @param password
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError, WrongPassword}
   *
   */
  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
  ): Promise<void> {
    try {
      const wallet = this.#realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (wallet.accounts!.filtered('id = $0', accountId).length === 0) {
        return Promise.reject(
          new OneKeyInternalError(
            `Account ${accountId} associated with Wallet ${walletId} not found.`,
          ),
        );
      }
      const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (wallet.type in [WALLET_TYPE_HD, WALLET_TYPE_IMPORTED]) {
        const context = this.#realm!.objectForPrimaryKey<ContextSchema>(
          'Context',
          'mainContext',
        );
        if (typeof context === 'undefined') {
          return Promise.reject(new OneKeyInternalError('Context not found.'));
        }
        if (!checkPassword(context, password)) {
          return Promise.reject(new WrongPassword());
        }
      }
      this.#realm!.write(() => {
        wallet.accounts!.delete(account);
        this.#realm!.delete(account);
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * rename an certain account
   * @param accountId
   * @param name new name
   * @returns {Promise<DBAccount>}
   * @throws {OneKeyInternalError}
   *
   */
  setAccountName(accountId: string, name: string): Promise<DBAccount> {
    try {
      const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      this.#realm!.write(() => {
        account.name = name;
      });
      return Promise.resolve(account as unknown as DBAccount);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * ????
   * @param accountId
   * @param networkId
   * @param address
   * @throws {OneKeyInternalError, NotImplemented}
   */
  addAccountAddress(
    accountId: string,
    _networkId: string,
    address: string,
  ): Promise<DBAccount> {
    try {
      const account = this.#realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (account.type === ACCOUNT_TYPE_SIMPLE) {
        this.#realm!.write(() => {
          account.address = address;
        });
      } else {
        /* this.#realm!.write(() => {
          account.addresses!.add(address);
        }); */
        throw new NotImplemented();
      }
      return Promise.resolve(account as unknown as DBAccount);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }
}
export { RealmDB };
