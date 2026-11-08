const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const utilsPath = path.resolve(
    __dirname,
    '../admin/accounts/accounts-profitability-utils.js'
);

const utilsSource = fs.readFileSync(utilsPath, 'utf8');

const sandbox = { console };

vm.createContext(sandbox);

vm.runInContext(utilsSource, sandbox, {
    filename: utilsPath
});

const utils = sandbox.AccountsProfitabilityUtils;

assert.ok(
    utils,
    'AccountsProfitabilityUtils should be exposed by the utilities file'
);

assert.equal(
    typeof utils.filterProfitabilityBookings,
    'function',
    'filterProfitabilityBookings should be exported'
);

test('excludes only bookings explicitly marked for exclusion', () => {
    const flagged = {
        id: 'test-booking',
        excludeFromProfitability: true
    };

    const retained = {
        id: 'normal-booking',
        excludeFromProfitability: false
    };

    const noFlag = {
        id: 'legacy-booking'
    };

    const result = utils.filterProfitabilityBookings([
        flagged,
        retained,
        noFlag
    ]);

    assert.deepStrictEqual(
        Array.from(result),
        [retained, noFlag]
    );
});

test('does not modify the original bookings array', () => {
    const bookings = [
        {
            id: 'excluded',
            excludeFromProfitability: true
        },
        {
            id: 'included'
        }
    ];

    const originalLength = bookings.length;

    const result = utils.filterProfitabilityBookings(bookings);

    assert.equal(bookings.length, originalLength);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'included');
});

test('returns an empty array when no bookings are supplied', () => {
    const result = utils.filterProfitabilityBookings();

    assert.deepStrictEqual(
        Array.from(result),
        []
    );
});

test('excludes only expenses explicitly marked for exclusion', () => {
    const flagged = {
        id: 'test-expense',
        excludeFromProfitability: true
    };

    const retained = {
        id: 'normal-expense',
        excludeFromProfitability: false
    };

    const noFlag = {
        id: 'legacy-expense'
    };

    const result = utils.filterProfitabilityExpenses([
        flagged,
        retained,
        noFlag
    ]);

    assert.deepStrictEqual(
        Array.from(result),
        [retained, noFlag]
    );
});

test('does not modify the original expenses array', () => {
    const expenses = [
        {
            id: 'excluded',
            excludeFromProfitability: true
        },
        {
            id: 'included'
        }
    ];

    const result = utils.filterProfitabilityExpenses(expenses);

    assert.equal(expenses.length, 2);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'included');
});

test('returns an empty array when no expenses are supplied', () => {
    const result = utils.filterProfitabilityExpenses();

    assert.deepStrictEqual(
        Array.from(result),
        []
    );
});
