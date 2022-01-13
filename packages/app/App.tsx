/* eslint-disable import/first */
/* eslint-disable import/order */
import './shim';

import React, { FC } from 'react';

import 'expo-dev-client';

import crypto from 'crypto';

console.log('hello world');
console.log(
  'hehe=====',
  crypto.createHash('sha256').update('test').digest('hex'),
);

import { Provider } from '@onekeyhq/kit';

console.disableYellowBox = true;

const App: FC = function () {
  return <Provider />;
};

export default App;
