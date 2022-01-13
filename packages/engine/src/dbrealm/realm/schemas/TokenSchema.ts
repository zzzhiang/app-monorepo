import Realm from 'realm';

class TokenSchema extends Realm.Object {
  public id!: string;

  public name!: string;

  public networkId!: string;

  public tokenIdOnNetwork!: string;

  public symbol!: string;

  public logoURI?: string;

  public decimals!: number;

  public static schema: Realm.ObjectSchema = {
    name: 'Token',
    primaryKey: 'id',
    properties: {
      id: 'string',
      name: { type: 'string', indexed: true },
      network_id: { type: 'string', mapTo: 'networkId' },
      token_id: { type: 'string', mapTo: 'tokenIdOnNetwork' },
      symbol: 'string',
      decimals: 'int',
      logo_uri: { type: 'string?', mapTo: 'logoURI' },
    },
  };
}
export { TokenSchema };
