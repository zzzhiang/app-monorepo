
import Engine from '@onekeyhq/engine';

const engine = new Engine();
console.log('hello', engine);
async function init() {
  const networks = await engine.listNetworks();
  const evmNetworks = networks.get('evm');
  if (!evmNetworks) {
    return;
  }

  const network = evmNetworks[0];

  const account = await engine.addWatchingAccount(
    'evm',
    '0x354245fe78bb274cb560521249ff4e79290144a5',
    'test1',
  );

  const [_balance, token] = await engine.preAddToken(
    account.id,
    network.id,
    '0x3b484b82567a09e2588a13d54d032153f0c0aee0',
  );

  await engine.addTokenToAccount(account.id, token.id);

  console.log('== init data done == ', account);
}

init();
export default engine;
