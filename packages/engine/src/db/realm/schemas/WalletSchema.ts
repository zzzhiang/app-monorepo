import { AccountSchema } from '.';

import Realm from 'realm';

import { WalletType } from '../../../types/wallet';

class WalletSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public type!: WalletType;

  public backuped?: boolean;

  public accounts?: Realm.Set<AccountSchema>;

  public nextAccountId?: Realm.Dictionary<number>;

  public static schema: Realm.ObjectSchema = {
    name: 'Wallet',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: 'string',
      type: 'string',
      backuped: { type: 'bool', default: false },
      accounts: { type: 'Account<>', default: [] },
      nextAccountId: { type: 'string, int', default: {} },
    },
  };
}

export { WalletSchema };
