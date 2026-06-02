(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AccountStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const INITIAL_BALANCE = 1000;

  function normalizeDeviceId(deviceId) {
    return String(deviceId || '').trim().slice(0, 80) || 'unknown-device';
  }

  function createAccountStore({ adminPin = '888888' } = {}) {
    const accounts = new Map();

    function getOrCreate(deviceId, name = '') {
      const key = normalizeDeviceId(deviceId);
      if (!accounts.has(key)) {
        accounts.set(key, {
          deviceId: key,
          name: String(name || '').trim().slice(0, 16),
          balance: INITIAL_BALANCE,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      const account = accounts.get(key);
      if (name) account.name = String(name).trim().slice(0, 16);
      return account;
    }

    function setBalance(deviceId, balance) {
      const account = getOrCreate(deviceId);
      account.balance = Math.max(0, Number(balance || 0));
      account.updatedAt = Date.now();
      return account;
    }

    function requireAdmin(pin) {
      if (String(pin || '') !== String(adminPin || '888888')) throw new Error('admin pin required');
    }

    function adjust(deviceId, delta, pin) {
      requireAdmin(pin);
      const account = getOrCreate(deviceId);
      return setBalance(account.deviceId, account.balance + Number(delta || 0));
    }

    return {
      getOrCreate,
      setBalance,
      adjust,
      list: () => [...accounts.values()]
    };
  }

  return {
    INITIAL_BALANCE,
    createAccountStore
  };
});
