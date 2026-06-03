const test = require('node:test');
const assert = require('node:assert/strict');
const accounts = require('../public/src/accounts.js');

test('new device starts with 1000 virtual points', () => {
  const store = accounts.createAccountStore({ adminPin: '123456' });
  const account = store.getOrCreate('phone-a');

  assert.equal(account.deviceId, 'phone-a');
  assert.equal(account.balance, 1000);
});

test('same device keeps its existing balance when rejoining', () => {
  const store = accounts.createAccountStore({ adminPin: '123456' });
  store.setBalance('phone-a', 640);

  assert.equal(store.getOrCreate('phone-a').balance, 640);
});

test('admin pin controls add and subtract adjustments', () => {
  const store = accounts.createAccountStore({ adminPin: '123456' });

  assert.throws(() => store.adjust('phone-a', 200, 'bad'), /admin/i);
  assert.equal(store.adjust('phone-a', 200, '123456').balance, 1000);
  assert.equal(store.adjust('phone-a', -500, '123456').balance, 500);
  assert.equal(store.adjust('phone-a', -9999, '123456').balance, 0);
});

test('account balances are capped between 0 and 1000 virtual points', () => {
  const store = accounts.createAccountStore({ adminPin: '123456' });

  assert.equal(store.setBalance('phone-a', 1600).balance, 1000);
  assert.equal(store.setBalance('phone-a', -50).balance, 0);
});
